const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 450,
    backgroundColor: "#1a1a2e",
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 1000 },
            debug: false
        }
    },
    scene: { preload, create, update },
    parent: "game"
};

const game = new Phaser.Game(config);

let player, cursors, keyDash, keyAttack;
let dashing = false, attacking = false;
let lastDash = 0;
let dashDir = new Phaser.Math.Vector2();
let jumps = 0, maxJumps = 2;
let airDashes = 0, maxAirDashes = 1;
let trailEmitter, attacks;

function preload() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(0xffcc00);
    g.fillRect(0, 0, 40, 60);
    g.generateTexture("player", 40, 60);

    g.clear();
    g.fillStyle(0x3344aa);
    g.fillRect(0, 0, 200, 30);
    g.generateTexture("platform", 200, 30);

    g.clear();
    g.fillStyle(0xff5555);
    g.fillRect(0, 0, 50, 20);
    g.generateTexture("slash", 50, 20);
}

function create() {
    const platforms = this.physics.add.staticGroup();
    platforms.create(400, 430, "platform").setScale(4, 1).refreshBody();
    platforms.create(150, 300, "platform");
    platforms.create(650, 250, "platform");

    player = this.physics.add.sprite(100, 200, "player");
    player.setCollideWorldBounds(true);
    player.body.setSize(30, 58);
    this.physics.add.collider(player, platforms);

    cursors = this.input.keyboard.createCursorKeys();
    keyJump = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    keyDash = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    keyAttack = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);

    // Trail
    const particles = this.add.particles(0, 0, null, {
        speed: 20,
        scale: { start: 0.4, end: 0 },
        lifespan: 150,
        quantity: 1,
        blendMode: "ADD",
        tint: 0xffcc00
    });
    trailEmitter = particles;
    trailEmitter.stop();

    // Attacks
    attacks = this.physics.add.group({ allowGravity: false });
    this.physics.add.collider(attacks, platforms, (a) => a.destroy());
}

function update(time, delta) {
    const onGround = player.body.blocked.down;
    const speed = 250;
    const dashSpeed = 650;
    const dashDuration = 180;
    const dashCooldown = 600;

    if (onGround) {
        jumps = 0;
        airDashes = 0;
    }

    if (!dashing && !attacking) {
        let vx = 0;
        if (cursors.left.isDown) vx -= speed;
        if (cursors.right.isDown) vx += speed;
        player.setVelocityX(vx);

        // Jump (↑ or Space)
        if (Phaser.Input.Keyboard.JustDown(keyJump) && jumps < maxJumps) {
            player.setVelocityY(-500);
            jumps++;
        }

        // Dash
        if (Phaser.Input.Keyboard.JustDown(keyDash) && time > lastDash + dashCooldown) {
            const canDash = onGround || airDashes < maxAirDashes;
            if (canDash) {
                dashDir.set(0, 0);
                if (cursors.left.isDown) dashDir.x = -1;
                else if (cursors.right.isDown) dashDir.x = 1;
                if (cursors.up.isDown) dashDir.y = -1;
                else if (cursors.down.isDown) dashDir.y = 1;
                if (dashDir.lengthSq() === 0)
                    dashDir.set(player.body.velocity.x >= 0 ? 1 : -1, 0);
                dashDir.normalize();

                startDash(this, dashDir, dashSpeed, dashDuration);
                lastDash = time;
                if (!onGround) airDashes++;
            }
        }

        // Attack
        if (Phaser.Input.Keyboard.JustDown(keyAttack)) {
            startAttack(this);
        }
    } else if (dashing) {
        player.setVelocity(dashDir.x * dashSpeed, dashDir.y * dashSpeed);
    }
}

// ====== DASH ======
function startDash(scene, dir, speed, duration) {
    dashing = true;
    player.body.allowGravity = false;
    player.setVelocity(dir.x * speed, dir.y * speed);

    trailEmitter.startFollow(player);
    trailEmitter.start();

    player.setScale(1.1, 0.9);
    player.setTint(0xffee77);

    scene.time.delayedCall(duration, () => {
        dashing = false;
        player.body.allowGravity = true;
        player.setScale(1, 1);
        player.clearTint();
        trailEmitter.stop();
    });
}

// ====== ATTACK ======
function startAttack(scene) {
    if (attacking) return;
    attacking = true;

    const dir = player.body.velocity.x >= 0 ? 1 : -1;
    const slash = attacks.create(player.x + dir * 35, player.y, "slash");
    slash.setVelocityX(dir * 500);
    slash.setDepth(1);

    player.setTint(0xff8888);
    player.setScale(1.1, 0.9);

    scene.time.delayedCall(120, () => {
        slash.destroy();
        player.clearTint();
        player.setScale(1, 1);
        attacking = false;
    });
}
