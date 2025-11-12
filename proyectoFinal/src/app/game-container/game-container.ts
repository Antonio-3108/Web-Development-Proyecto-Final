import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import Phaser from 'phaser';

@Component({
  selector: 'app-game-container',
  templateUrl: './game-container.html',
  styleUrls: ['./game-container.css'],
})
export class GameContainerComponent implements OnInit, OnDestroy {
  @ViewChild('gameContainer', { static: true }) gameContainer!: ElementRef<HTMLDivElement>;

  private phaserGame!: Phaser.Game;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  // Dash / jump params
  private dashAvailable = true;
  private isDashing = false;
  private dashTime = 0;
  private readonly DASH_SPEED = 300;
  private readonly DASH_DURATION = 120;

  private canDoubleJump = true;
  private jumpBufferTime = 0;
  private readonly JUMP_BUFFER = 100;
  private coyoteTime = 0;
  private readonly COYOTE_DURATION = 150;

  // Canvas size
  private readonly stageWidth = 1200;
  private readonly stageHeight = 600;

  // Spawn position
  private spawnX = 0;
  private spawnY = 0;

  ngOnInit() {
    this.initializeGame();
  }

  ngOnDestroy() {
    if (this.phaserGame) this.phaserGame.destroy(true);
  }

  private initializeGame() {
    const outer = this;

    class GameScene extends Phaser.Scene {
      public player!: Phaser.Physics.Arcade.Sprite;
      private map!: Phaser.Tilemaps.Tilemap;
      private mainLayer?: Phaser.Tilemaps.TilemapLayer;
      private backgroundLayer?: Phaser.Tilemaps.TilemapLayer;
      private deathZones: Phaser.GameObjects.Rectangle[] = [];
      private isRespawning = false;

      constructor() {
        super({ key: 'GameScene' });
      }

      preload() {
        // Cargar el mapa JSON
        this.load.tilemapTiledJSON('stage', 'tiled/test_map.json');

        // Cargar sprite del jugador 1
        this.load.image('player', 'sprites/player1.png');

        this.load.on('loaderror', (file: any) => {
          if (file.key === 'player') {
            console.warn('Player sprite not found, creating fallback texture');
            if (!this.textures.exists('player')) {
              const g = this.add.graphics();
              g.fillStyle(0x4a90e2, 1);
              g.fillRect(0, 0, 16, 16);
              g.generateTexture('player', 16, 16);
              g.destroy();
            }
          }
        });
      }

      async create() {
        this.map = this.make.tilemap({ key: 'stage' });

        const tilemapCache = this.cache.tilemap.get('stage');
        const tilemapData = tilemapCache?.data;

        const tilesetImageFiles: { tilesetName: string; filename: string }[] = [];

        if (tilemapData && tilemapData.tilesets) {
          for (const ts of tilemapData.tilesets) {
            if (ts.image) {
              const parts = ts.image.replace(/\\/g, '/').split('/');
              const filename = parts[parts.length - 1];
              tilesetImageFiles.push({
                tilesetName: ts.name,
                filename: filename
              });
            }
          }
        }

        const imagesToLoad: { key: string; url: string }[] = [];
        for (const t of tilesetImageFiles) {
          const key = t.filename.replace(/\.[^.]+$/, '');
          if (!this.textures.exists(key)) {
            imagesToLoad.push({ key, url: `tiled/${t.filename}` });
          }
        }

        if (imagesToLoad.length > 0) {
          for (const im of imagesToLoad) {
            this.load.image(im.key, im.url);
          }
          await new Promise<void>(resolve => {
            this.load.once('complete', () => resolve());
            this.load.start();
          });
        }

        const addedTilesets: Phaser.Tilemaps.Tileset[] = [];
        for (const t of tilesetImageFiles) {
          const imageKey = t.filename.replace(/\.[^.]+$/, '');

          try {
            const tileset = this.map.addTilesetImage(t.tilesetName, imageKey);
            if (tileset) {
              addedTilesets.push(tileset);
            }
          } catch (e) {
            console.error(`Error adding tileset "${t.tilesetName}":`, e);
          }
        }

        if (addedTilesets.length === 0) {
          console.error('No tilesets added. Check that images exist in public/tiled/');
          return;
        }

        const mapW = this.map.widthInPixels || 480;
        const mapH = this.map.heightInPixels || 240;

        const worldW = mapW * 3;
        const worldH = mapH * 3;

        const offsetX = mapW;
        const offsetY = mapH;

        this.physics.world.setBounds(0, 0, worldW, worldH);

        this.backgroundLayer = this.map.createLayer('Background', addedTilesets, offsetX, offsetY) || undefined;
        if (this.backgroundLayer) {
        }

        this.mainLayer = this.map.createLayer('Stage', addedTilesets, offsetX, offsetY) || undefined;

        if (!this.mainLayer) {
          console.error('Failed to create Stage layer');
          return;
        }

        this.mainLayer.forEachTile((tile) => {
          if (tile.index > 0) {
            if (tile.index === 9 || tile.index === 10 || tile.index === 11) {
              tile.setCollision(false, false, false, false);
            } else {
              tile.setCollision(true, true, true, true);
            }
          }
        });

        const deathZoneThickness = 50;
        const deathZoneDistanceSides = 200;
        const deathZoneDistanceBottom = 80;

        const topZone = this.add.rectangle(
          offsetX + mapW / 2,
          offsetY - deathZoneDistanceSides - deathZoneThickness / 2,
          mapW + deathZoneDistanceSides * 2,
          deathZoneThickness,
          0xff0000,
          0
        );
        this.physics.add.existing(topZone, true);
        this.deathZones.push(topZone);

        const bottomZone = this.add.rectangle(
          offsetX + mapW / 2,
          offsetY + mapH + deathZoneDistanceBottom + deathZoneThickness / 2,
          mapW + deathZoneDistanceSides * 2,
          deathZoneThickness,
          0xff0000,
          0
        );
        this.physics.add.existing(bottomZone, true);
        this.deathZones.push(bottomZone);

        const leftZone = this.add.rectangle(
          offsetX - deathZoneDistanceSides - deathZoneThickness / 2,
          offsetY + mapH / 2,
          deathZoneThickness,
          mapH + deathZoneDistanceSides * 2,
          0xff0000,
          0
        );
        this.physics.add.existing(leftZone, true);
        this.deathZones.push(leftZone);

        const rightZone = this.add.rectangle(
          offsetX + mapW + deathZoneDistanceSides + deathZoneThickness / 2,
          offsetY + mapH / 2,
          deathZoneThickness,
          mapH + deathZoneDistanceSides * 2,
          0xff0000,
          0
        );
        this.physics.add.existing(rightZone, true);
        this.deathZones.push(rightZone);

        // SPAWN
        const spawnX = 240;
        const spawnY = 100;

        outer.spawnX = spawnX + offsetX;
        outer.spawnY = spawnY + offsetY;

        this.player = this.physics.add.sprite(outer.spawnX, outer.spawnY, 'player');
        this.player.setDisplaySize(28, 21);

        const pbody = this.player.body as Phaser.Physics.Arcade.Body;
        pbody.setSize(16, 18);
        pbody.setOffset(6, 3);

        // Fisicas
        pbody.setGravityY(800);
        pbody.setDragX(1000);
        pbody.setMaxVelocity(250, 1000);
        pbody.setBounce(0, 0);
        pbody.setCollideWorldBounds(false);
        pbody.setFriction(1, 0);

        this.physics.add.collider(this.player, this.mainLayer, undefined, undefined, this);

        for (const zone of this.deathZones) {
          this.physics.add.overlap(this.player, zone, () => {
            if (!this.isRespawning) {
              this.respawnPlayer();
            }
          });
        }

        const cam = this.cameras.main;

        (this as any).mapWidth = mapW;
        (this as any).mapHeight = mapH;

        const zoomByHeight = cam.height / mapH;
        const zoom = zoomByHeight;

        cam.setZoom(zoom);
        cam.centerOn(offsetX + mapW / 2, offsetY + mapH / 2);

        // Inputs
        if (this.input.keyboard) {
          outer.cursors = this.input.keyboard.createCursorKeys();
          outer.keys = this.input.keyboard.addKeys({
            Z: Phaser.Input.Keyboard.KeyCodes.Z,
            X: Phaser.Input.Keyboard.KeyCodes.X,
            C: Phaser.Input.Keyboard.KeyCodes.C,
          }) as Record<string, Phaser.Input.Keyboard.Key>;
        }

        setTimeout(() => {
          try {
            const canvas = this.game.canvas as HTMLCanvasElement;
            if (canvas && typeof canvas.focus === 'function') canvas.focus();
          } catch {}
        }, 50);
      }

      respawnPlayer() {
        if (this.player && this.player.active && !this.isRespawning) {
          this.isRespawning = true;

          const pbody = this.player.body as Phaser.Physics.Arcade.Body;
          pbody.enable = false;

          pbody.stop();
          pbody.setVelocity(0, 0);
          pbody.setAcceleration(0, 0);

          this.tweens.add({
            targets: this.player,
            alpha: 0,
            duration: 300,
            ease: 'Power2'
          });

          this.time.delayedCall(500, () => {
            if (!this.player || !this.player.active) return;

            pbody.setGravityY(800);
            pbody.setDragX(1000);
            pbody.setAllowGravity(true);

            this.player.setPosition(outer.spawnX, outer.spawnY);
            pbody.updateFromGameObject();

            outer.isDashing = false;
            outer.dashAvailable = true;
            outer.canDoubleJump = true;

            this.tweens.add({
              targets: this.player,
              alpha: 1,
              duration: 300,
              ease: 'Power2'
            });

            this.time.delayedCall(100, () => {
              if (pbody) {
                pbody.enable = true;
                this.isRespawning = false;
              }
            });
          });
        }
      }

      override update(time: number, delta: number) {
        if (!this.player) return;

        this.handleFloatingPlatforms();
        outer.handleControls(this, this.player, time);
      }

      handleFloatingPlatforms() {
        if (!this.player || !this.mainLayer) return;

        const pbody = this.player.body as Phaser.Physics.Arcade.Body;

        const layerOffsetX = this.mainLayer.x;
        const layerOffsetY = this.mainLayer.y;

        const playerBottom = pbody.y + pbody.height;
        const playerLeft = pbody.x;
        const playerRight = pbody.x + pbody.width;

        const tilesBelow = this.mainLayer.getTilesWithinWorldXY(
          playerLeft - 4,
          playerBottom - 4,
          pbody.width + 8,
          12,
          { isNotEmpty: true }
        );

        let standingOnPlatform = false;
        let closestPlatformTop = Infinity;

        for (const tile of tilesBelow) {
          if (tile.index === 9 || tile.index === 10 || tile.index === 11) {
            const tileTop = tile.pixelY + layerOffsetY;
            const tileLeft = tile.pixelX + layerOffsetX;
            const tileRight = tileLeft + tile.width;

            const horizontalOverlap = playerRight > tileLeft + 2 && playerLeft < tileRight - 2;

            if (!horizontalOverlap) continue;

            const distanceToTop = playerBottom - tileTop;

            const prevY = (this.player as any).prevPlayerY || pbody.y;
            const prevBottom = prevY + pbody.height;

            const comingFromAbove = prevBottom <= tileTop + 8;

            if (pbody.velocity.y >= 0 && distanceToTop >= -3 && distanceToTop <= 8 && comingFromAbove) {
              if (tileTop < closestPlatformTop) {
                closestPlatformTop = tileTop;
                standingOnPlatform = true;
              }
            }
          }
        }

        (this.player as any).prevPlayerY = pbody.y;

        if (standingOnPlatform && closestPlatformTop !== Infinity) {
          pbody.y = closestPlatformTop - pbody.height;
          pbody.setVelocityY(0);
          pbody.touching.down = true;
          pbody.blocked.down = true;
        }
      }
    }

    const cfg: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: this.stageWidth,
      height: this.stageHeight,
      parent: this.gameContainer.nativeElement,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
          tileBias: 32,
          overlapBias: 8
        }
      },
      scene: [GameScene],
      backgroundColor: '#87CEEB',
      pixelArt: true,
      antialias: false,
    };

    this.phaserGame = new Phaser.Game(cfg);
  }

  // ---------- Controls / movement ----------
  private handleControls(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite, time: number) {
    const body = player.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    const onGround = body.blocked.down || body.touching.down;

    // Fisicas
    const acceleration = 1500;
    const airAcceleration = 1000;
    const maxGroundSpeed = 200;
    const maxAirSpeed = 220;
    const jumpSpeed = 320;

    const left = this.cursors?.left.isDown ?? false;
    const right = this.cursors?.right.isDown ?? false;
    const up = this.cursors?.up.isDown ?? false;
    const down = this.cursors?.down.isDown ?? false;
    const z = this.keys?.['Z']?.isDown ?? false;

    const jumpJustPressed =
      (this.cursors?.up && Phaser.Input.Keyboard.JustDown(this.cursors.up)) ||
      (this.keys?.['Z'] && Phaser.Input.Keyboard.JustDown(this.keys['Z']));
    const dashPressed = this.keys?.['X'] && Phaser.Input.Keyboard.JustDown(this.keys['X']);
    const attackPressed = this.keys?.['C'] && Phaser.Input.Keyboard.JustDown(this.keys['C']);

    const jumpHeld = up || z;
    if (jumpJustPressed) this.jumpBufferTime = time;

    if (onGround) {
      this.canDoubleJump = true;
      this.dashAvailable = true;
      this.coyoteTime = time;

      if (time - this.jumpBufferTime < this.JUMP_BUFFER) {
        body.setVelocityY(-jumpSpeed);
        this.jumpBufferTime = 0;
      }
    }

    const canCoyoteJump = time - this.coyoteTime < this.COYOTE_DURATION;

    // Dashing state
    if (this.isDashing) {
      if (time > this.dashTime + this.DASH_DURATION) {
        this.isDashing = false;
        body.setDragX(1000);
        body.setGravityY(800);
      } else return;
    }

    // Movement
    if (!this.isDashing) {
      const curAccel = onGround ? acceleration : airAcceleration;
      const limit = onGround ? maxGroundSpeed : maxAirSpeed;

      if (left) {
        body.setAccelerationX(-curAccel);
        player.setFlipX(true);
        if (body.velocity.x < -limit) body.velocity.x = -limit;
      } else if (right) {
        body.setAccelerationX(curAccel);
        player.setFlipX(false);
        if (body.velocity.x > limit) body.velocity.x = limit;
      } else {
        body.setAccelerationX(0);
        body.setDragX(onGround ? 1500 : 500);
      }

      // Jump / double jump
      if (jumpJustPressed && time - this.jumpBufferTime < 50) {
        if (onGround || canCoyoteJump) {
          body.setVelocityY(-jumpSpeed);
          this.coyoteTime = 0;
        } else if (this.canDoubleJump) {
          body.setVelocityY(-jumpSpeed * 0.9);
          this.canDoubleJump = false;
        }
      }

      // Variable jump height
      if (body.velocity.y < 0 && !jumpHeld) {
        body.setVelocityY(body.velocity.y * 0.5);
      }

      if (body.velocity.y > 50 && !onGround) {
        body.setGravityY(1000);
      } else if (body.velocity.y < 0) {
        body.setGravityY(700);
      } else {
        body.setGravityY(800);
      }
    }

    // Dash
    if (this.dashAvailable && !this.isDashing && dashPressed) {
      this.dashAvailable = false;
      this.isDashing = true;
      this.dashTime = time;

      let dx = 0, dy = 0;
      if (up) dy = -1;
      if (down) dy = 1;
      if (left) dx = -1;
      if (right) dx = 1;
      if (dx === 0 && dy === 0) dx = player.flipX ? -1 : 1;

      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) { dx /= len; dy /= len; }

      body.setVelocity(dx * this.DASH_SPEED, dy * this.DASH_SPEED);
      body.setAcceleration(0, 0);
      body.setDrag(0, 0);
      body.setGravityY(0);

      // Visual trail
      const trail = scene.add.rectangle(player.x, player.y, 28, 21, 0xff6b6b, 0.7).setDepth(-1);
      scene.tweens.add({
        targets: trail,
        alpha: 0,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: this.DASH_DURATION,
        onComplete: () => trail.destroy()
      });

      // Dash hurtbox
      const hurtbox = scene.add.rectangle(player.x + dx * 24, player.y + dy * 12, 28, 24, 0xff0000, 0.5);
      scene.physics.add.existing(hurtbox);
      const hBody = hurtbox.body as Phaser.Physics.Arcade.Body;
      hBody.setAllowGravity(false);
      hBody.setImmovable(true);
      const follow = scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          if (hurtbox.active) {
            hurtbox.x = player.x + dx * 24;
            hurtbox.y = player.y + dy * 12;
          }
        }
      });
      scene.time.delayedCall(this.DASH_DURATION, () => {
        follow.remove(false);
        if (hurtbox.active) hurtbox.destroy();
      });
    }

    // Attack
    if (attackPressed) {
      const dir = player.flipX ? -1 : 1;
      const hit = scene.add.rectangle(player.x + dir * 24, player.y, 24, 20, 0xffff00, 0.9);
      scene.physics.add.existing(hit);
      const aBody = hit.body as Phaser.Physics.Arcade.Body;
      aBody.setAllowGravity(false);
      aBody.setImmovable(true);
      scene.time.delayedCall(120, () => hit.destroy());
    }
  }
}
