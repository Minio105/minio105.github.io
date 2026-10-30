/* =========================================================
   MOSTOWNIA — solver fizyczny
   Sprężyste pręty + grawitacja + zrywanie + pojazd kontaktowy.
   Model siłowy z całkowaniem pół-jawnym i stałym krokiem 1/360 s.
   ========================================================= */
"use strict";

(function () {
  const SOLVER_DT = 1 / 360;
  const CONTACT_SLOP = 13;
  // Koło może zanurzyć się w jezdni tylko na chwilę (np. przy ugięciu).
  // Gdy spadnie znacznie poniżej pomostu, nie ma już kontaktu — inaczej
  // solver „windowałby” pojazd z powrotem na drogę przez zerwane przęsło.
  const CONTACT_MAX_PENETRATION = 28;
  const NODE_RADIUS = 4;

  // Zapas bezpieczeństwa: element pęka dopiero przy wyraźnym przekroczeniu
  // nośności, a nie przy chwilowym przeregulowaniu solvera.
  const BREAK_OVERLOAD = 1.12;
  // Most najpierw się układa pod własnym ciężarem. W tym czasie pęka tylko
  // konstrukcja przeciążona w sposób oczywisty (np. zbyt ciężka i wiotka).
  const SETTLE_GRACE = 2.6;
  const SETTLE_GROSS_OVERLOAD = 1.6;
  const DAMPING_RATIO = 0.32;

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function shortestAngle(from, to) {
    let d = (to - from + Math.PI) % (Math.PI * 2);
    if (d < 0) d += Math.PI * 2;
    return d - Math.PI;
  }

  class BridgeSimulation {
    constructor(level, designBeams) {
      this.level = level;
      this.designBeams = designBeams;
      this.nodes = [];
      this.nodeMap = new Map();
      this.beams = [];
      this.brokenBeams = [];
      this.fragments = [];
      this.pendingLoads = [];
      this.time = 0;
      this.brokenCount = 0;
      this.maxStress = 0;
      this.breakEvents = [];
      this.lastBreakAt = -10;
      this._build();
    }

    _getOrCreateNode(designNode) {
      let node = this.nodeMap.get(designNode.id);
      if (node) return node;
      node = {
        id: designNode.id,
        x: designNode.x,
        y: designNode.y,
        ox: designNode.x,
        oy: designNode.y,
        vx: 0,
        vy: 0,
        fx: 0,
        fy: 0,
        mass: 0,
        invMass: 0,
        fixed: designNode.fixed,
        kind: designNode.kind,
        radius: NODE_RADIUS,
        active: true
      };
      this.nodeMap.set(designNode.id, node);
      this.nodes.push(node);
      return node;
    }

    _build() {
      const level = this.level;

      for (const designBeam of this.designBeams) {
        const designA = level.nodeById[designBeam.a];
        const designB = level.nodeById[designBeam.b];
        if (!designA || !designB) continue;

        const a = this._getOrCreateNode(designA);
        const b = this._getOrCreateNode(designB);
        const material = MATERIALS[designBeam.material];
        if (!material) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rest = Math.hypot(dx, dy);
        if (rest < 5) continue;

        const mass = material.density * (rest / PX_PER_M);
        a.mass += mass * 0.5;
        b.mass += mass * 0.5;

        const beam = {
          id: designBeam.id,
          design: designBeam,
          a,
          b,
          material,
          rest,
          mass,
          k: material.EA / rest,
          damping: 0,
          force: 0,
          springForce: 0,
          stress: 0,
          stressKind: "none",
          broken: false,
          renderStress: 0,
          color: material.color
        };
        this.beams.push(beam);
      }

      // Masa węzłów i tłumienie zależą od gotowej topologii.
      for (const node of this.nodes) {
        node.mass = Math.max(4, node.mass);
        node.invMass = node.fixed ? 0 : 1 / node.mass;
      }

      for (const beam of this.beams) {
        const effectiveMass = 1 / (beam.a.invMass + beam.b.invMass || 1);
        beam.dampingBase = 2 * DAMPING_RATIO * Math.sqrt(Math.max(1, beam.k * effectiveMass));
        beam.damping = beam.dampingBase;
      }

      this.gravity = GRAVITY;
      this.floorY = level.world.floorY;
      this.minX = 0;
      this.maxX = level.world.w;
    }

    addPointLoad(beam, t, forceY, forceX = 0) {
      if (!beam || beam.broken) return;
      this.pendingLoads.push({ beam, t: clamp(t, 0, 1), forceY, forceX });
    }

    surfaceAt(x) {
      let best = null;

      for (const segment of this.level.shoreSegments) {
        if (x >= Math.min(segment.x1, segment.x2) && x <= Math.max(segment.x1, segment.x2)) {
          const t = (x - segment.x1) / Math.max(0.0001, segment.x2 - segment.x1);
          const y = lerp(segment.y1, segment.y2, clamp(t, 0, 1));
          if (!best || y < best.y) {
            best = {
              y,
              x,
              slope: (segment.y2 - segment.y1) / Math.max(0.001, segment.x2 - segment.x1),
              source: "shore",
              beam: null,
              t: 0
            };
          }
        }
      }

      for (const beam of this.beams) {
        if (beam.broken || beam.material.id !== "road") continue;
        const x1 = beam.a.x;
        const x2 = beam.b.x;
        const dx = x2 - x1;
        if (Math.abs(dx) < 0.5) continue;
        if (x < Math.min(x1, x2) || x > Math.max(x1, x2)) continue;
        const t = clamp((x - x1) / dx, 0, 1);
        const y = lerp(beam.a.y, beam.b.y, t);
        if (!best || y < best.y) {
          best = {
            y,
            x,
            slope: (beam.b.y - beam.a.y) / dx,
            source: "bridge",
            beam,
            t
          };
        }
      }

      return best;
    }

    _applyBreak(beam, reason) {
      if (beam.broken) return;
      beam.broken = true;
      beam.brokenReason = reason;
      beam.breakTime = this.time;
      this.brokenCount++;
      this.brokenBeams.push(beam);
      this.lastBreakAt = this.time;
      this.breakEvents.push({
        x: (beam.a.x + beam.b.x) * 0.5,
        y: (beam.a.y + beam.b.y) * 0.5,
        material: beam.material,
        reason
      });

      // Dwa odłamki lecące w dół — niezależnie od resztek kratownicy.
      const midX = (beam.a.x + beam.b.x) * 0.5;
      const midY = (beam.a.y + beam.b.y) * 0.5;
      const dx = beam.b.x - beam.a.x;
      const dy = beam.b.y - beam.a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const angle = Math.atan2(dy, dx);
      const vx = (beam.a.vx + beam.b.vx) * 0.5;
      const vy = (beam.a.vy + beam.b.vy) * 0.5;

      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        this.fragments.push({
          x: midX + ux * beam.rest * 0.2 * side,
          y: midY + uy * beam.rest * 0.2 * side,
          vx: vx + ux * 28 * side + (Math.random() - 0.5) * 20,
          vy: vy + uy * 24 * side - 20 - Math.random() * 35,
          angle,
          angular: (Math.random() - 0.5) * 7,
          length: beam.rest * 0.42,
          material: beam.material,
          life: 5.5,
          maxLife: 5.5
        });
      }
    }

    step(dt = SOLVER_DT) {
      if (dt <= 0) return;
      this.time += dt;
      this.breakEvents.length = 0;
      const rampT = clamp(this.time / 2.2, 0, 1);
      const gravityScale = rampT * rampT * (3 - 2 * rampT);
      const activeGravity = this.gravity * gravityScale;
      const settling = this.time < SETTLE_GRACE;
      const overloadFactor = settling ? SETTLE_GROSS_OVERLOAD : BREAK_OVERLOAD;
      const dampingScale = 1;
      const velocityDamping = settling ? 0.996 : 0.99965;

      for (const node of this.nodes) {
        node.fx = 0;
        node.fy = node.fixed ? 0 : node.mass * (activeGravity / PX_PER_M);
      }

      // Obciążenie od kół jest przykładane do węzłów drogi.
      for (const load of this.pendingLoads) {
        const beam = load.beam;
        if (!beam || beam.broken) continue;
        const t = load.t;
        const fx = load.forceX;
        const fy = load.forceY;
        beam.a.fx += fx * (1 - t);
        beam.a.fy += fy * (1 - t);
        beam.b.fx += fx * t;
        beam.b.fy += fy * t;
      }
      this.pendingLoads.length = 0;

      // Siły sprężyste w prętach.
      for (const beam of this.beams) {
        if (beam.broken) continue;
        const a = beam.a;
        const b = beam.b;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let len = Math.hypot(dx, dy);
        if (len < 0.001) len = 0.001;
        const ux = dx / len;
        const uy = dy / len;
        const extension = len - beam.rest;
        const springForce = beam.k * extension;
        const relVel = (b.vx - a.vx) * ux + (b.vy - a.vy) * uy;

        let totalForce = springForce + beam.dampingBase * dampingScale * relVel;
        const maxLimit = Math.max(beam.material.maxTension, beam.material.maxCompression);
        const cap = Math.max(1000, maxLimit * 18);
        totalForce = clamp(totalForce, -cap, cap);

        if (beam.material.id === "cable" && extension <= 0) {
          totalForce = 0;
        }

        const forceX = totalForce * ux;
        const forceY = totalForce * uy;
        a.fx += forceX;
        a.fy += forceY;
        b.fx -= forceX;
        b.fy -= forceY;

        beam.force = totalForce;
        beam.springForce = springForce;
        beam.extension = extension;
        beam.length = len;

        let ratio = 0;
        if (springForce >= 0) {
          if (beam.material.maxTension > 0) {
            ratio = springForce / beam.material.maxTension;
            beam.stressKind = ratio > 0.03 ? "tension" : "none";
          }
        } else {
          const compression = -springForce;
          if (beam.material.maxCompression > 0) {
            ratio = compression / beam.material.maxCompression;
            beam.stressKind = ratio > 0.03 ? "compression" : "none";
          } else {
            ratio = 0;
            beam.stressKind = "none";
          }
        }
        beam.stress = ratio;
        beam.renderStress = Math.max(beam.renderStress * 0.92, ratio);
        if (ratio > this.maxStress) this.maxStress = ratio;

        if (
          (beam.material.maxTension > 0 && springForce > beam.material.maxTension * overloadFactor) ||
          (beam.material.maxCompression > 0 && -springForce > beam.material.maxCompression * overloadFactor)
        ) {
          this._applyBreak(beam, springForce > 0 ? "tension" : "compression");
        }
      }

      // Całkowanie.
      for (const node of this.nodes) {
        if (node.fixed) continue;
        const ax = node.fx * node.invMass * PX_PER_M;
        const ay = node.fy * node.invMass * PX_PER_M;
        node.vx += ax * dt;
        node.vy += ay * dt;
        node.vx *= velocityDamping;
        node.vy *= velocityDamping;
        node.x += node.vx * dt;
        node.y += node.vy * dt;

        if (node.y > this.floorY - node.radius) {
          node.y = this.floorY - node.radius;
          if (node.vy > 0) node.vy = -node.vy * 0.12;
          node.vx *= 0.72;
        }
        if (node.x < node.radius) {
          node.x = node.radius;
          node.vx = Math.abs(node.vx) * 0.18;
        } else if (node.x > this.maxX - node.radius) {
          node.x = this.maxX - node.radius;
          node.vx = -Math.abs(node.vx) * 0.18;
        }
      }

      this._updateFragments(dt);
    }

    _updateFragments(dt) {
      for (let i = this.fragments.length - 1; i >= 0; i--) {
        const f = this.fragments[i];
        f.life -= dt;
        if (f.life <= 0) {
          this.fragments.splice(i, 1);
          continue;
        }
        f.vy += GRAVITY * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.angle += f.angular * dt;
        if (f.y > this.floorY - 2) {
          f.y = this.floorY - 2;
          f.vy *= -0.18;
          f.vx *= 0.65;
          f.angular *= 0.6;
        }
      }
    }

    getStressPercent() {
      return clamp(this.maxStress * 100, 0, 999);
    }

    getLiveMaxStress() {
      let max = 0;
      for (const beam of this.beams) {
        if (!beam.broken) max = Math.max(max, beam.stress);
      }
      return max;
    }

    getDeflection() {
      let total = 0;
      let count = 0;
      for (const beam of this.beams) {
        if (beam.broken || beam.material.id !== "road") continue;
        total += (beam.a.y + beam.b.y) * 0.5;
        count++;
      }
      if (!count) return 0;
      const average = total / count;
      const original = (this.level.yL + this.level.yR) * 0.5;
      return Math.max(0, average - original);
    }
  }

  class VehicleSimulation {
    constructor(level, vehicle) {
      this.level = level;
      this.vehicle = vehicle;
      this.startX = level.startX;
      this.x = level.startX;
      this.y = level.yL - vehicle.wheelRadius;
      this.vx = 0;
      this.vy = 0;
      this.angle = 0;
      this.omega = 0;
      this.started = false;
      this.finished = false;
      this.failed = false;
      this.time = 0;
      this.wheelSpin = 0;
      this.contactCount = 0;
      this.lastContacts = [];
      this.airTime = 0;
      this.highestX = this.x;
      this.bounce = 0;
      this.loadFactor = 0;
      this.finishTime = null;
    }

    start() {
      this.started = true;
    }

    _wheelPositions() {
      const half = this.vehicle.wheelbase * 0.5;
      const cos = Math.cos(this.angle);
      const sin = Math.sin(this.angle);
      return {
        rear: { x: this.x - cos * half, y: this.y - sin * half },
        front: { x: this.x + cos * half, y: this.y + sin * half }
      };
    }

    update(dt, sim) {
      if (!this.started || this.finished || this.failed) {
        return;
      }
      this.time += dt;
      this.bounce += dt;

      const v = this.vehicle;
      const oldVx = this.vx;
      const oldHalf = v.wheelbase * 0.5;
      const cos = Math.cos(this.angle);
      const sin = Math.sin(this.angle);
      const rearX = this.x - cos * oldHalf;
      const rearY = this.y - sin * oldHalf;
      const frontX = this.x + cos * oldHalf;
      const frontY = this.y + sin * oldHalf;
      const rearSurface = sim.surfaceAt(rearX);
      const frontSurface = sim.surfaceAt(frontX);

      const rearGap = rearSurface ? rearY + v.wheelRadius - rearSurface.y : 0;
      const frontGap = frontSurface ? frontY + v.wheelRadius - frontSurface.y : 0;
      const rearContact = Boolean(
        rearSurface && rearGap >= -CONTACT_SLOP && rearGap <= CONTACT_MAX_PENETRATION
      );
      const frontContact = Boolean(
        frontSurface && frontGap >= -CONTACT_SLOP && frontGap <= CONTACT_MAX_PENETRATION
      );

      this.contactCount = (rearContact ? 1 : 0) + (frontContact ? 1 : 0);
      this.lastContacts = [];

      if (this.contactCount === 2) {
        const dx = Math.max(0.001, cos * v.wheelbase);
        const targetAngle = Math.atan2(frontSurface.y - rearSurface.y, dx);
        const diff = shortestAngle(this.angle, targetAngle);
        this.angle += diff * Math.min(1, dt * 12);
        const desiredY =
          (rearSurface.y + frontSurface.y) * 0.5 -
          v.wheelRadius;
        const ay = (desiredY - this.y) * 90 - this.vy * 14;
        this.vy += ay * dt;
        this.y += this.vy * dt;
        this.omega = 0;
        this.airTime = 0;
      } else if (this.contactCount === 1) {
        const surface = frontContact ? frontSurface : rearSurface;
        const offset = frontContact ? oldHalf : -oldHalf;
        const desiredY = surface.y - v.wheelRadius - Math.sin(this.angle) * offset;
        const ay = (desiredY - this.y) * 72 - this.vy * 12;
        this.vy += ay * dt;
        this.y += this.vy * dt;
        this.omega += (frontContact ? -1.35 : 1.35) * dt;
        this.omega = clamp(this.omega, -2.2, 2.2);
        this.angle += this.omega * dt;
        this.angle = clamp(this.angle, -0.8, 0.8);
        this.airTime += dt;
      } else {
        this.vy += GRAVITY * dt;
        this.y += this.vy * dt;
        this.omega += 0.38 * dt;
        this.omega = clamp(this.omega, -3.2, 3.2);
        this.angle += this.omega * dt;
        this.airTime += dt;
      }

      const grounded = this.contactCount > 0;
      let targetSpeed = v.speed;

      if (grounded) {
        let slope = 0;
        if (rearSurface && frontSurface) {
          slope = (frontSurface.y - rearSurface.y) / Math.max(0.001, cos * v.wheelbase);
        } else if (frontContact || rearContact) {
          slope = (frontContact ? frontSurface.slope : rearSurface.slope);
        }
        targetSpeed *= clamp(1 + slope * 0.36, 0.62, 1.18);
        const accel = 2.7;
        this.vx += (targetSpeed - this.vx) * Math.min(1, accel * dt);
      } else {
        this.vx *= 1 - 0.04 * dt;
      }

      this.x += this.vx * dt;
      if (this.x > this.highestX) this.highestX = this.x;
      this.wheelSpin += (this.vx / v.wheelRadius) * dt;

      // Obciążenie mostu: siła nacisku kół. Reakcja trafia dokładnie
      // w punkty na odcinkach drogi, więc siła przechodzi na kratownicę.
      const weight = v.mass * (GRAVITY / PX_PER_M);
      let bridgeLoad = 0;
      const transfers = [];
      const share = this.contactCount === 2 ? 0.5 : 1;
      const dynamicFactor = 1 + clamp(Math.abs(this.vy) / 500, 0, 0.22);

      if (frontContact && frontSurface) {
        const load = weight * share * dynamicFactor;
        if (frontSurface.source === "bridge" && frontSurface.beam) {
          sim.addPointLoad(frontSurface.beam, frontSurface.t, load, 0);
          bridgeLoad += load;
        }
        transfers.push({
          wheel: "front",
          x: frontX,
          y: frontSurface.y,
          load,
          contact: frontSurface
        });
      }
      if (rearContact && rearSurface) {
        const load = weight * share * dynamicFactor;
        if (rearSurface.source === "bridge" && rearSurface.beam) {
          sim.addPointLoad(rearSurface.beam, rearSurface.t, load, 0);
          bridgeLoad += load;
        }
        transfers.push({
          wheel: "rear",
          x: rearX,
          y: rearSurface.y,
          load,
          contact: rearSurface
        });
      }
      this.lastContacts = transfers;
      this.loadFactor = bridgeLoad / Math.max(1, weight);

      if (this.x > this.level.finishX && this.contactCount > 0) {
        this.finished = true;
        this.finishTime = this.time;
      }

      if (this.y > this.level.world.floorY - 26) {
        this.failed = true;
      }

      // Awaryjnie: pojazd przewrócony poza planszą.
      if (this.x < -120 || this.x > this.level.world.w + 120) {
        this.failed = true;
      }

      // Zapamiętanie starej prędkości przydaje się do efektów wizualnych.
      this.acceleration = (this.vx - oldVx) / Math.max(0.0001, dt);
      this.grounded = grounded;
      this.speedKmh = (Math.abs(this.vx) / PX_PER_M) * 3.6;
    }

    getSpeed() {
      return this.vx;
    }
  }

  window.BridgePhysics = {
    SOLVER_DT,
    BridgeSimulation,
    VehicleSimulation,
    shortestAngle
  };
})();
