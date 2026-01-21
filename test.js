// Extract and run physics tests in Node.js

class PhysicsEngine {
    constructor(config = {}) {
        this.gravity = config.gravity ?? 800;
        this.friction = config.friction ?? 0.92;
        this.bounceDamping = config.bounceDamping ?? 0.5;
        this.collisionDamping = config.collisionDamping ?? 0.8;
        this.velocityThreshold = config.velocityThreshold ?? 5;
        this.minBounceRatio = config.minBounceRatio ?? 0.3; // Minimum bounce as ratio of approach velocity
        this.bounds = config.bounds ?? { width: 800, height: 600 };
        this.squares = [];
    }

    addSquare(config) {
        const square = {
            id: config.id ?? this.squares.length,
            size: config.size,
            mass: config.size, // Linear mass for more balanced bounces
            x: config.x ?? 0,
            y: config.y ?? 0,
            vx: config.vx ?? 0,
            vy: config.vy ?? 0,
            isDragged: false
        };
        this.squares.push(square);
        return square;
    }

    setBounds(width, height) {
        this.bounds = { width, height };
    }

    checkCollision(a, b) {
        return a.x < b.x + b.size &&
               a.x + a.size > b.x &&
               a.y < b.y + b.size &&
               a.y + a.size > b.y;
    }

    getCollisionInfo(a, b) {
        const overlapX = Math.min(a.x + a.size - b.x, b.x + b.size - a.x);
        const overlapY = Math.min(a.y + a.size - b.y, b.y + b.size - a.y);
        const isHorizontal = overlapX < overlapY;

        return {
            overlapX,
            overlapY,
            isHorizontal,
            aLeftOfB: a.x + a.size / 2 < b.x + b.size / 2,
            aAboveB: a.y + a.size / 2 < b.y + b.size / 2
        };
    }

    resolveCollision(a, b) {
        if (!this.checkCollision(a, b)) return false;

        const info = this.getCollisionInfo(a, b);
        const totalMass = a.mass + b.mass;
        const aRatio = b.mass / totalMass;
        const bRatio = a.mass / totalMass;

        if (info.isHorizontal) {
            // Separate horizontally
            if (info.aLeftOfB) {
                a.x -= info.overlapX * aRatio;
                b.x += info.overlapX * bRatio;
            } else {
                a.x += info.overlapX * aRatio;
                b.x -= info.overlapX * bRatio;
            }

            // Calculate relative velocity along collision normal
            const normalDir = info.aLeftOfB ? 1 : -1;
            const relVelAlongNormal = (a.vx - b.vx) * normalDir;

            // Only resolve if approaching
            if (relVelAlongNormal > 0) {
                // Impulse magnitude
                const j = -(1 + this.collisionDamping) * relVelAlongNormal / (1/a.mass + 1/b.mass);

                // Apply impulse
                a.vx += (j / a.mass) * normalDir;
                b.vx -= (j / b.mass) * normalDir;

                // For horizontal collisions, standard physics is fine (pushing feels natural)
            }
        } else {
            // Separate vertically
            if (info.aAboveB) {
                a.y -= info.overlapY * aRatio;
                b.y += info.overlapY * bRatio;
            } else {
                a.y += info.overlapY * aRatio;
                b.y -= info.overlapY * bRatio;
            }

            // Calculate relative velocity along collision normal
            const normalDir = info.aAboveB ? 1 : -1;
            const relVelAlongNormal = (a.vy - b.vy) * normalDir;

            // Only resolve if approaching
            if (relVelAlongNormal > 0) {
                // Impulse magnitude
                const j = -(1 + this.collisionDamping) * relVelAlongNormal / (1/a.mass + 1/b.mass);

                // Apply impulse
                a.vy += (j / a.mass) * normalDir;
                b.vy -= (j / b.mass) * normalDir;

                // Ensure minimum bounce - if object isn't moving away, give it minimum bounce
                const minBounce = relVelAlongNormal * this.minBounceRatio * this.collisionDamping;

                // a should move opposite to normal (away from b)
                if (a.vy * normalDir >= 0) {
                    a.vy = -minBounce * normalDir;
                }
                // b should move along normal (away from a)
                if (b.vy * normalDir <= 0) {
                    b.vy = minBounce * normalDir;
                }
            }
        }

        return true;
    }

    constrainToBounds(square) {
        const maxX = this.bounds.width - square.size;
        const maxY = this.bounds.height - square.size;
        let hitBoundary = false;

        if (square.x < 0) {
            square.x = 0;
            square.vx = -square.vx * this.bounceDamping;
            hitBoundary = true;
        } else if (square.x > maxX) {
            square.x = maxX;
            square.vx = -square.vx * this.bounceDamping;
            hitBoundary = true;
        }

        if (square.y < 0) {
            square.y = 0;
            square.vy = -square.vy * this.bounceDamping;
            hitBoundary = true;
        } else if (square.y > maxY) {
            square.y = maxY;
            square.vy = -square.vy * this.bounceDamping;
            hitBoundary = true;
        }

        return hitBoundary;
    }

    applyVelocityThreshold(square) {
        if (Math.abs(square.vx) < this.velocityThreshold) square.vx = 0;
        if (Math.abs(square.vy) < this.velocityThreshold) square.vy = 0;
    }

    step(dt) {
        for (const square of this.squares) {
            if (square.isDragged) continue;
            square.vy += this.gravity * dt;
            square.vx *= this.friction;
            square.x += square.vx * dt;
            square.y += square.vy * dt;
        }

        for (const square of this.squares) {
            this.constrainToBounds(square);
        }

        for (let iter = 0; iter < 4; iter++) {
            for (let i = 0; i < this.squares.length; i++) {
                for (let j = i + 1; j < this.squares.length; j++) {
                    this.resolveCollision(this.squares[i], this.squares[j]);
                }
            }
        }

        for (const square of this.squares) {
            this.constrainToBounds(square);
            this.applyVelocityThreshold(square);
        }
    }
}

// Test runner
class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    assert(condition, message) {
        if (!condition) throw new Error(message || 'Assertion failed');
    }

    assertApprox(actual, expected, tolerance, message) {
        if (Math.abs(actual - expected) > tolerance) {
            throw new Error(message || `Expected ${expected} ± ${tolerance}, got ${actual}`);
        }
    }

    run() {
        console.log('\n🧪 Running Physics Engine Tests\n');

        for (const { name, fn } of this.tests) {
            try {
                fn();
                this.passed++;
                console.log(`  ✅ ${name}`);
            } catch (e) {
                this.failed++;
                console.log(`  ❌ ${name}`);
                console.log(`     Error: ${e.message}`);
            }
        }

        console.log(`\n📊 Results: ${this.passed}/${this.tests.length} passed`);
        if (this.failed > 0) {
            console.log(`   ${this.failed} test(s) failed\n`);
            process.exit(1);
        } else {
            console.log('   All tests passed!\n');
        }
    }
}

// Run tests
const runner = new TestRunner();

runner.test('Gravity increases vy', function() {
    const engine = new PhysicsEngine({ gravity: 100 });
    const sq = engine.addSquare({ size: 50, x: 100, y: 100, vx: 0, vy: 0 });
    engine.step(0.1);
    runner.assert(sq.vy > 0, `vy should increase, got ${sq.vy}`);
});

runner.test('Friction reduces vx', function() {
    const engine = new PhysicsEngine({ friction: 0.9, gravity: 0 });
    const sq = engine.addSquare({ size: 50, x: 100, y: 100, vx: 100, vy: 0 });
    const initialVx = sq.vx;
    engine.step(0.1);
    runner.assert(Math.abs(sq.vx) < Math.abs(initialVx), `vx should decrease`);
});

runner.test('Bottom boundary stops square', function() {
    const engine = new PhysicsEngine({ bounds: { width: 800, height: 600 } });
    const sq = engine.addSquare({ size: 50, x: 100, y: 600, vy: 100 });
    engine.step(0.1);
    runner.assertApprox(sq.y, 550, 1, 'Square should be at bottom');
});

runner.test('Right boundary stops square', function() {
    const engine = new PhysicsEngine({ gravity: 0, bounds: { width: 800, height: 600 } });
    const sq = engine.addSquare({ size: 50, x: 800, y: 100, vx: 100 });
    engine.step(0.1);
    runner.assertApprox(sq.x, 750, 1, 'Square should be at right edge');
});

runner.test('Collision detection - overlapping', function() {
    const engine = new PhysicsEngine();
    const a = engine.addSquare({ size: 50, x: 100, y: 100 });
    const b = engine.addSquare({ size: 50, x: 120, y: 100 });
    runner.assert(engine.checkCollision(a, b), 'Squares should collide');
});

runner.test('Collision detection - separate', function() {
    const engine = new PhysicsEngine();
    const a = engine.addSquare({ size: 50, x: 100, y: 100 });
    const b = engine.addSquare({ size: 50, x: 200, y: 100 });
    runner.assert(!engine.checkCollision(a, b), 'Squares should not collide');
});

runner.test('Collision separates overlapping squares', function() {
    const engine = new PhysicsEngine();
    const a = engine.addSquare({ size: 50, x: 100, y: 100, vx: 0, vy: 0 });
    const b = engine.addSquare({ size: 50, x: 120, y: 100, vx: 0, vy: 0 });
    engine.resolveCollision(a, b);
    runner.assert(!engine.checkCollision(a, b), 'Squares should be separated after resolution');
});

runner.test('Head-on collision - equal mass velocity exchange', function() {
    const engine = new PhysicsEngine({ collisionDamping: 1.0 });
    const a = engine.addSquare({ size: 50, x: 100, y: 100, vx: 100, vy: 0 });
    const b = engine.addSquare({ size: 50, x: 149, y: 100, vx: -100, vy: 0 });

    engine.resolveCollision(a, b);

    runner.assert(a.vx < 0, `a.vx should be negative after collision, got ${a.vx}`);
    runner.assert(b.vx > 0, `b.vx should be positive after collision, got ${b.vx}`);
});

runner.test('Moving square transfers momentum to stationary', function() {
    const engine = new PhysicsEngine({ collisionDamping: 1.0 });
    const a = engine.addSquare({ size: 50, x: 100, y: 100, vx: 100, vy: 0 });
    const b = engine.addSquare({ size: 50, x: 149, y: 100, vx: 0, vy: 0 });

    engine.resolveCollision(a, b);

    runner.assert(b.vx > 0, `Stationary square should gain velocity, got ${b.vx}`);
});

runner.test('Vertical collision - dropping square bounces', function() {
    const engine = new PhysicsEngine({ collisionDamping: 1.0, gravity: 0 });
    const a = engine.addSquare({ size: 50, x: 100, y: 100, vx: 0, vy: 100 });
    const b = engine.addSquare({ size: 50, x: 100, y: 149, vx: 0, vy: 0 });

    engine.resolveCollision(a, b);

    runner.assert(a.vy < 50, `Falling square should slow/reverse, got ${a.vy}`);
    runner.assert(b.vy > 0, `Bottom square should gain downward velocity, got ${b.vy}`);
});

runner.test('Heavy square pushes light square more', function() {
    const engine = new PhysicsEngine({ collisionDamping: 1.0 });
    const heavy = engine.addSquare({ size: 100, x: 100, y: 100, vx: 50, vy: 0 });
    const light = engine.addSquare({ size: 50, x: 199, y: 125, vx: 0, vy: 0 });

    engine.resolveCollision(heavy, light);

    runner.assert(heavy.vx > 0, 'Heavy square should still move right');
    runner.assert(light.vx > 25, `Light square should move fast, got ${light.vx}`);
});

runner.test('Stacked squares settle without jitter', function() {
    const engine = new PhysicsEngine({
        gravity: 800,
        bounds: { width: 800, height: 600 },
        velocityThreshold: 5
    });
    const bottom = engine.addSquare({ size: 50, x: 100, y: 550, vx: 0, vy: 0 });
    const top = engine.addSquare({ size: 50, x: 100, y: 500, vx: 0, vy: 0 });

    for (let i = 0; i < 60; i++) {
        engine.step(1/60);
    }

    runner.assert(Math.abs(bottom.vy) < 10, `Bottom should be stable, vy=${bottom.vy}`);
    runner.assert(Math.abs(top.vy) < 10, `Top should be stable, vy=${top.vy}`);
});

// Test: Heavy vs Light bounce - both should bounce
runner.test('Heavy (120px) drops onto Light (60px) - heavy bounces up', function() {
    const engine = new PhysicsEngine({ collisionDamping: 0.8, gravity: 0 });
    // Blue box (120px) - with linear mass = 120
    const heavy = engine.addSquare({ size: 120, x: 100, y: 100, vx: 0, vy: 200 });
    // Purple box (60px) - with linear mass = 60
    const light = engine.addSquare({ size: 60, x: 130, y: 219, vx: 0, vy: 0 });

    console.log(`\n    Before: Heavy vy=${heavy.vy}, Light vy=${light.vy}`);
    engine.resolveCollision(heavy, light);
    console.log(`    After:  Heavy vy=${heavy.vy.toFixed(1)}, Light vy=${light.vy.toFixed(1)}`);

    // Heavy should bounce UP (negative vy) for natural feel
    runner.assert(heavy.vy < 0, `Heavy should bounce up, but vy=${heavy.vy.toFixed(2)}`);
});

runner.test('Light (60px) drops onto Heavy (120px) - light bounces up', function() {
    const engine = new PhysicsEngine({ collisionDamping: 0.8, gravity: 0 });
    // Purple box (60px) - with linear mass = 60
    const light = engine.addSquare({ size: 60, x: 130, y: 100, vx: 0, vy: 200 });
    // Blue box (120px) - with linear mass = 120
    const heavy = engine.addSquare({ size: 120, x: 100, y: 159, vx: 0, vy: 0 });

    console.log(`\n    Before: Light vy=${light.vy}, Heavy vy=${heavy.vy}`);
    engine.resolveCollision(light, heavy);
    console.log(`    After:  Light vy=${light.vy.toFixed(1)}, Heavy vy=${heavy.vy.toFixed(1)}`);

    // Light should bounce UP (negative vy)
    runner.assert(light.vy < 0, `Light should bounce up, vy=${light.vy.toFixed(2)}`);
});

runner.run();
