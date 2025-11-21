import { Component, ElementRef, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Phaser from 'phaser';
import { MultiplayerService, PlayerState } from '../multiplayer';
import { LocalMapsService } from '../services/local-maps';
@Component({
  selector: 'app-game-container',
  templateUrl: './game-container.html',
  styleUrls: ['./game-container.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class GameContainerComponent implements OnInit, OnDestroy {
  @ViewChild('gameContainer', { static: true }) gameContainer!: ElementRef<HTMLDivElement>;
  public multiplayerService = inject(MultiplayerService);
  private router = inject(Router);
  public localMapsService = inject(LocalMapsService);
  private phaserGame!: Phaser.Game;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private gameScene?: Phaser.Scene;
  readonly showMenu = signal(true);
  readonly hostId = signal('');
  readonly isGeneratingCode = signal(false);
  readonly isConnecting = signal(false);
  connectId = '';
  selectedMapId = ''; 
  readonly peerId = this.multiplayerService.peerId;
  readonly connected = this.multiplayerService.connected;
  readonly role = this.multiplayerService.role;
  readonly error = this.multiplayerService.error;
  readonly latency = this.multiplayerService.latency;
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
  private readonly stageWidth = 1200;
  private readonly stageHeight = 600;
  private spawnX = 0;
  private spawnY = 0;
  readonly playerStocks = signal(3);
  readonly remotePlayerStocks = signal(3);
  readonly playerPercent = signal(0);
  readonly remotePlayerPercent = signal(0);
  private readonly MAX_STOCKS = 3;
  ngOnInit(): void {
    this.multiplayerService.onRemoteState((state) => {
      if (this.gameScene && (this.gameScene as any).updateRemotePlayer) {
        (this.gameScene as any).updateRemotePlayer(state);
      }
    });
    this.multiplayerService.onEvent('startGame', (data) => {
      if (data?.selectedMapId) {
        this.selectedMapId = data.selectedMapId;
      }
      if (data?.mapData) {
        this.localMapsService.downloadMap(data.mapData);
      }
      this.initializeGame();
      this.showMenu.set(false);
    });
    this.multiplayerService.onEvent('playerLost', (data) => {
      if (this.gameScene && (this.gameScene as any).showGameOver) {
        (this.gameScene as any).showGameOver();
      }
    });
    setInterval(() => {
      if (!this.showMenu() && !this.connected() && this.phaserGame) {
        this.multiplayerService.error.set('Conexión perdida con el otro jugador');
      }
    }, 2000);
  }
  ngOnDestroy(): void {
    if (this.phaserGame) {
      this.phaserGame.destroy(true);
    }
    this.multiplayerService.disconnect();
  }
  async startHost(): Promise<void> {
    try {
      this.isGeneratingCode.set(true);
      this.multiplayerService.error.set(null);
      const id = await this.multiplayerService.host();
      this.hostId.set(id);
    } catch (err: any) {
      this.multiplayerService.error.set('No se pudo crear la partida. Intenta de nuevo.');
    } finally {
      this.isGeneratingCode.set(false);
    }
  }
  async startClient(): Promise<void> {
    if (!this.connectId.trim()) {
      this.multiplayerService.error.set('Por favor ingresa el ID del host');
      return;
    }
    try {
      this.isConnecting.set(true);
      this.multiplayerService.error.set(null);
      await this.multiplayerService.connect(this.connectId.trim().toUpperCase());
    } catch (err: any) {
      this.multiplayerService.error.set('No se pudo conectar. Verifica el ID del host.');
    } finally {
      this.isConnecting.set(false);
    }
  }
  startGameAsHost(): void {
    if (!this.connected()) {
      this.multiplayerService.error.set('Esperando a que el cliente se conecte...');
      return;
    }
    const eventData: any = { 
      startedBy: this.peerId(),
      selectedMapId: this.selectedMapId || null
    };
    if (this.selectedMapId) {
      const selectedMap = this.localMapsService.getMapById(this.selectedMapId);
      if (selectedMap) {
        eventData.mapData = selectedMap;
      }
    }
    this.multiplayerService.sendEvent('startGame', eventData);
    this.initializeGame();
    this.showMenu.set(false);
  }
  backToMenu(): void {
    if (this.phaserGame) {
      if (this.phaserGame.scene.scenes[0]) {
        const scene = this.phaserGame.scene.scenes[0];
        if (scene.physics && scene.physics.world) {
          scene.physics.world.timeScale = 1;
        }
        if (scene.time) {
          scene.time.timeScale = 1;
        }
      }
      this.phaserGame.destroy(true);
    }
    this.multiplayerService.disconnect();
    this.showMenu.set(true);
    this.hostId.set('');
    this.connectId = '';
    this.isGeneratingCode.set(false);
    this.isConnecting.set(false);
    this.playerStocks.set(this.MAX_STOCKS);
    this.remotePlayerStocks.set(this.MAX_STOCKS);
    this.playerPercent.set(0);
    this.remotePlayerPercent.set(0);
  }
  goBackToPreviousPage(): void {
    if (this.phaserGame) {
      if (this.phaserGame.scene.scenes[0]) {
        const scene = this.phaserGame.scene.scenes[0];
        if (scene.physics && scene.physics.world) {
          scene.physics.world.timeScale = 1;
        }
        if (scene.time) {
          scene.time.timeScale = 1;
        }
      }
      this.phaserGame.destroy(true);
    }
    this.multiplayerService.disconnect();
    window.history.back();
  }
  getSelectedMapName(): string {
    if (!this.selectedMapId) return 'Mapa por defecto';
    const map = this.localMapsService.getMapById(this.selectedMapId);
    return map ? map.name : 'Mapa por defecto';
  }
  private initializeGame(): void {
    const outer = this;
    class GameScene extends Phaser.Scene {
      public player!: Phaser.Physics.Arcade.Sprite;
      public remotePlayer?: Phaser.Physics.Arcade.Sprite;
      private map!: Phaser.Tilemaps.Tilemap;
      private backgroundLayer?: Phaser.Tilemaps.TilemapLayer;
      private stageLayer?: Phaser.Tilemaps.TilemapLayer;
      private platformsLayer?: Phaser.Tilemaps.TilemapLayer;
      private deathZones: Phaser.GameObjects.Rectangle[] = [];
      private isRespawning = false;
      private lastStateSent = 0;
      private readonly STATE_SEND_INTERVAL = 50;
      private playerHitboxes: Phaser.GameObjects.Rectangle[] = [];
      private remoteHitboxes: Phaser.GameObjects.Rectangle[] = [];
      private playerDashHitbox?: Phaser.GameObjects.Rectangle;
      private remoteDashHitbox?: Phaser.GameObjects.Rectangle;
      private hitStunTime = 0;
      private isInHitStun = false;
      constructor() {
        super({ key: 'GameScene' });
      }
      preload() {
        this.load.tilemapTiledJSON('stage', 'tiled/map.json');
        this.load.image('player1', 'sprites/player1.png');
        this.load.image('player2', 'sprites/player2.png');
        this.load.image('Sprite-0005', 'tiled/Sprite-0005.png');
        this.load.image('Sprite-0006-Sheet', 'tiled/Sprite-0006-Sheet.png');
        this.load.on('loaderror', (file: any) => {
          if ((file.key === 'player1' || file.key === 'player2') && !this.textures.exists(file.key)) {
            const g = this.add.graphics();
            const color = file.key === 'player1' ? 0x4a90e2 : 0xe24a4a;
            g.fillStyle(color, 1).fillRect(0, 0, 16, 16);
            g.generateTexture(file.key, 16, 16);
            g.destroy();
          }
        });
      }
      create() {
        outer.gameScene = this;
        this.map = this.make.tilemap({ key: 'stage' });
        const ts1 = this.map.addTilesetImage('Sprite-0005', 'Sprite-0005');
        const ts2 = this.map.addTilesetImage('Sprite-0006-Sheet', 'Sprite-0006-Sheet');
        const tilesets = [ts1, ts2].filter(Boolean) as Phaser.Tilemaps.Tileset[];
        const mapW = this.map.widthInPixels;
        const mapH = this.map.heightInPixels;
        const offX = mapW;
        const offY = mapH;
        this.backgroundLayer = this.map.createLayer('Background', tilesets, offX, offY) || undefined;
        this.stageLayer = this.map.createLayer('Stage', tilesets, offX, offY) || undefined;
        this.platformsLayer = this.map.createLayer('Plataforms', tilesets, offX, offY) || undefined;
        if (this.stageLayer) {
          this.stageLayer.setCollisionBetween(1, 13, true);
        }
        if (this.platformsLayer) {
          this.platformsLayer.setCollisionBetween(1, 13, true);
        }
        this.physics.world.setBounds(0, 0, mapW * 3, mapH * 3);
        const cam = this.cameras.main;
        cam.setZoom(cam.height / mapH);
        cam.centerOn(offX + mapW / 2, offY + mapH / 2);
        const isHost = outer.multiplayerService.role() === 'host' || !outer.multiplayerService.role();
        const playerSprite = isHost ? 'player1' : 'player2';
        const spawnsLayer = this.map.getObjectLayer('Spawns');
        let player1Spawn = { x: offX + 136.5, y: offY + 108.833333333333 }; 
        let player2Spawn = { x: offX + 344.333333333333, y: offY + 109.895833333333 }; 
        if (spawnsLayer && spawnsLayer.objects) {
          const p1Obj = spawnsLayer.objects.find((obj: any) => obj.name === 'Player1_Spawn');
          const p2Obj = spawnsLayer.objects.find((obj: any) => obj.name === 'Player2_Spawn');
          if (p1Obj && p1Obj.x !== undefined && p1Obj.y !== undefined) {
            player1Spawn = { x: offX + p1Obj.x, y: offY + p1Obj.y };
          }
          if (p2Obj && p2Obj.x !== undefined && p2Obj.y !== undefined) {
            player2Spawn = { x: offX + p2Obj.x, y: offY + p2Obj.y };
          }
        }
        const mySpawn = isHost ? player1Spawn : player2Spawn;
        outer.spawnX = mySpawn.x;
        outer.spawnY = mySpawn.y;
        this.player = this.physics.add.sprite(outer.spawnX, outer.spawnY, playerSprite).setDisplaySize(28, 21);
        const b = this.player.body as Phaser.Physics.Arcade.Body;
        b.setSize(16, 18).setOffset(6, 3);
        b.setGravityY(800);
        b.setDragX(1000);
        b.setMaxVelocity(250, 1000);
        if (this.stageLayer) {
          this.physics.add.collider(this.player, this.stageLayer);
        }
        if (outer.multiplayerService.connected()) {
          const remoteSprite = isHost ? 'player2' : 'player1';
          const remoteSpawn = isHost ? player2Spawn : player1Spawn;
          this.remotePlayer = this.physics.add.sprite(remoteSpawn.x, remoteSpawn.y, remoteSprite).setDisplaySize(28, 21);
          const rb = this.remotePlayer.body as Phaser.Physics.Arcade.Body;
          rb.setSize(16, 18).setOffset(6, 3);
          rb.setGravityY(0);
          rb.setAllowGravity(false);
          if (this.stageLayer) {
            this.physics.add.collider(this.remotePlayer, this.stageLayer);
          }
          outer.multiplayerService.onRemoteState((state: PlayerState) => {
            this.updateRemotePlayer(state);
          });
        } else {
        }
        const sides = 200, thick = 50, bottom = 80;
        const addZone = (x: number, y: number, w: number, h: number) => {
          const r = this.add.rectangle(x, y, w, h, 0xff0000, 0);
          this.physics.add.existing(r, true);
          this.deathZones.push(r);
        };
        addZone(offX + mapW / 2, offY - sides - thick / 2, mapW + sides * 2, thick);
        addZone(offX + mapW / 2, offY + mapH + bottom + thick / 2, mapW + sides * 2, thick);
        addZone(offX - sides - thick / 2, offY + mapH / 2, thick, mapH + sides * 2);
        addZone(offX + mapW + sides + thick / 2, offY + mapH / 2, thick, mapH + sides * 2);
        for (const z of this.deathZones) {
          this.physics.add.overlap(this.player, z, () => !this.isRespawning && this.respawnPlayer());
        }
        if (this.input.keyboard) {
          outer.cursors = this.input.keyboard.createCursorKeys();
          outer.keys = this.input.keyboard.addKeys({
            Z: Phaser.Input.Keyboard.KeyCodes.Z,
            X: Phaser.Input.Keyboard.KeyCodes.X,
            C: Phaser.Input.Keyboard.KeyCodes.C,
          }) as any;
        }
      }
      updateRemotePlayer(state: PlayerState) {
        if (!this.remotePlayer) return;
        this.tweens.add({
          targets: this.remotePlayer,
          x: state.x,
          y: state.y,
          duration: 50,
          ease: 'Linear'
        });
        this.remotePlayer.setFlipX(state.flipX);
        const rb = this.remotePlayer.body as Phaser.Physics.Arcade.Body;
        if (rb) {
          rb.velocity.x = state.velocityX;
          rb.velocity.y = state.velocityY;
        }
        if (state.percent !== undefined) {
          outer.remotePlayerPercent.set(state.percent);
        }
        if (state.stocks !== undefined) {
          outer.remotePlayerStocks.set(state.stocks);
        }
        if (state.isAttacking && state.attackType) {
          this.createRemoteAttackHitbox(state.attackType);
        }
      }
      createRemoteAttackHitbox(type: 'normal' | 'dash' | 'up' | 'down') {
        if (!this.remotePlayer) return;
        const dir = this.remotePlayer.flipX ? -1 : 1;
        if (type === 'normal' || type === 'up' || type === 'down') {
          let hitX = this.remotePlayer.x + dir * 24;
          let hitY = this.remotePlayer.y;
          let hitColor = 0xffff00; 
          if (type === 'up') {
            hitX = this.remotePlayer.x;
            hitY = this.remotePlayer.y - 28;
            hitColor = 0x00ffff; 
          } else if (type === 'down') {
            hitX = this.remotePlayer.x;
            hitY = this.remotePlayer.y + 28;
            hitColor = 0xff00ff; 
          }
          const hit = this.add.rectangle(hitX, hitY, 32, 24, hitColor, 0.6);
          this.physics.add.existing(hit);
          (hit.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true);
          (hit as any).attackType = type;
          this.remoteHitboxes.push(hit);
          this.tweens.add({
            targets: hit,
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0,
            duration: 120,
            ease: 'Power2'
          });
          this.time.delayedCall(120, () => {
            hit.destroy();
            this.remoteHitboxes = this.remoteHitboxes.filter(h => h !== hit);
          });
        } else if (type === 'dash') {
          if (!this.remoteDashHitbox) {
            const dashHitbox = this.add.rectangle(
              this.remotePlayer.x,
              this.remotePlayer.y,
              32, 24, 0xff6b6b, 0
            );
            this.physics.add.existing(dashHitbox);
            (dashHitbox.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
            this.remoteDashHitbox = dashHitbox;
            this.time.delayedCall(120, () => {
              if (this.remoteDashHitbox) {
                this.remoteDashHitbox.destroy();
                this.remoteDashHitbox = undefined;
              }
            });
          }
        }
      }
      respawnPlayer() {
        if (!this.player || this.isRespawning) return;
        this.isRespawning = true;
        outer.playerStocks.set(outer.playerStocks() - 1);
        outer.playerPercent.set(0);
        if (outer.playerStocks() <= 0) {
          if (outer.multiplayerService.connected()) {
            outer.multiplayerService.sendEvent('playerLost', { 
              loser: outer.multiplayerService.peerId() 
            });
          }
          this.showGameOver();
          return;
        }
        const b = this.player.body as Phaser.Physics.Arcade.Body;
        b.enable = false;
        b.stop();
        b.setVelocity(0);
        this.tweens.add({ targets: this.player, alpha: 1, duration: 300 });
        this.time.delayedCall(500, () => {
          this.player.setPosition(outer.spawnX, outer.spawnY);
          b.enable = true;
          b.setGravityY(800);
          this.tweens.add({ targets: this.player, alpha: 1, duration: 300 });
          this.isRespawning = false;
          this.isInHitStun = false;
          this.hitStunTime = 0;
        });
      }
      showGameOver() {
        this.physics.world.timeScale = 2.5; 
        this.time.timeScale = 0.4; 
        const barHeight = 100;
        const gameOverBar = this.add.rectangle(
          this.cameras.main.centerX,
          this.cameras.main.centerY,
          this.cameras.main.width,
          barHeight,
          0x151414
        ).setOrigin(0.5).setScrollFactor(0).setDepth(1999);
        gameOverBar.x = -this.cameras.main.width / 2;
        this.tweens.add({
          targets: gameOverBar,
          x: this.cameras.main.centerX,
          duration: 600,
          ease: 'Power2'
        });
        const gameOverText = this.add.text(
          this.cameras.main.centerX,
          this.cameras.main.centerY,
          'GAME',
          {
            fontFamily: '"Josefin Sans", sans-serif',
            fontSize: '48px',
            fontStyle: 'italic',
            color: '#F4F3F2',
            resolution: 4
          }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
        gameOverText.x = -this.cameras.main.width / 2;
        gameOverText.alpha = 0;
        this.tweens.add({
          targets: gameOverText,
          x: this.cameras.main.centerX,
          alpha: 1,
          duration: 800,
          ease: 'Power2'
        });
        setTimeout(() => {
          this.tweens.add({
            targets: [gameOverBar, gameOverText],
            x: this.cameras.main.width + this.cameras.main.width / 2,
            duration: 800,
            ease: 'Power2'
          });
        }, 3500);
        setTimeout(() => {
          outer.backToMenu();
        }, 5000);
      }
      override update(t: number) {
        if (!this.player) return;
        this.handleFloatingPlatforms();
        if (this.isInHitStun && t > this.hitStunTime) {
          this.isInHitStun = false;
        }
        if (!this.isInHitStun) {
          outer.handleControls(this, this.player, t);
        }
        this.checkHitboxCollisions();
        if (outer.multiplayerService.connected() && t - this.lastStateSent > this.STATE_SEND_INTERVAL) {
          this.lastStateSent = t;
          const b = this.player.body as Phaser.Physics.Arcade.Body;
          const state: PlayerState = {
            x: this.player.x,
            y: this.player.y,
            velocityX: b.velocity.x,
            velocityY: b.velocity.y,
            flipX: this.player.flipX,
            isDashing: outer.isDashing,
            isAttacking: this.playerHitboxes.length > 0 || outer.isDashing,
            attackType: outer.isDashing ? 'dash' : (this.playerHitboxes.length > 0 ? (this.playerHitboxes[0] as any).attackType || 'normal' : undefined),
            percent: outer.playerPercent(),
            stocks: outer.playerStocks(),
            timestamp: t
          };
          outer.multiplayerService.sendPlayerState(state);
        }
      }
      checkHitboxCollisions() {
        if (!this.remotePlayer || this.isRespawning) return;
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        for (const hitbox of this.remoteHitboxes) {
          if (this.physics.overlap(this.player, hitbox)) {
            const attackType = (hitbox as any).attackType || 'normal';
            const dir = this.player.x > this.remotePlayer.x ? 1 : -1;
            const damage = attackType === 'up' || attackType === 'down' ? 12 : 15;
            this.applyKnockback(playerBody, dir, damage, attackType);
            hitbox.destroy();
            this.remoteHitboxes = this.remoteHitboxes.filter(h => h !== hitbox);
            break;
          }
        }
        if (this.remoteDashHitbox && this.physics.overlap(this.player, this.remoteDashHitbox)) {
          const dir = this.player.x > this.remotePlayer.x ? 1 : -1;
          this.applyKnockback(playerBody, dir, 5, 'dash'); 
        }
      }
      applyKnockback(body: Phaser.Physics.Arcade.Body, dirX: number, damage: number, type: 'normal' | 'dash' | 'up' | 'down') {
        if (this.isInHitStun) return;
        const newPercent = outer.playerPercent() + damage;
        outer.playerPercent.set(Math.min(newPercent, 999));
        const percentMultiplier = 1 + (outer.playerPercent() / 100);
        let baseForceX = 0;
        let baseForceY = 0;
        switch (type) {
          case 'normal':
            baseForceX = 350;
            baseForceY = -120; 
            break;
          case 'up':
            baseForceX = 100;
            baseForceY = -400; 
            break;
          case 'down':
            baseForceX = 150;
            baseForceY = -100; 
            break;
          case 'dash':
            baseForceX = 100;
            baseForceY = -80;
            break;
        }
        const finalForceX = baseForceX * percentMultiplier;
        const finalForceY = baseForceY * percentMultiplier;
        body.setVelocity(dirX * finalForceX, finalForceY);
        this.isInHitStun = true;
        this.hitStunTime = this.time.now + 300;
      }
      handleFloatingPlatforms() {
        const layer = this.platformsLayer;
        if (!layer) return;
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        const playerBottom = body.y + body.height;
        const playerLeft = body.x;
        const playerRight = playerLeft + body.width;
        const tilesBelow = layer.getTilesWithinWorldXY(
          playerLeft - 4,
          playerBottom - 4,
          body.width + 8,
          12,
          { isNotEmpty: true }
        );
        let standing = false;
        let topY = Infinity;
        for (const t of tilesBelow) {
          if ([9, 10, 11].includes(t.index)) {
            const tileTop = t.pixelY + layer.y;
            const tileLeft = t.pixelX + layer.x;
            const tileRight = tileLeft + t.width;
            const overlap = playerRight > tileLeft + 2 && playerLeft < tileRight - 2;
            const distance = playerBottom - tileTop;
            const prevY = (this.player as any).prevY ?? body.y;
            const prevBottom = prevY + body.height;
            const comingFromAbove = prevBottom <= tileTop + 8;
            if (overlap && body.velocity.y >= 0 && distance >= -3 && distance <= 8 && comingFromAbove) {
              if (tileTop < topY) {
                topY = tileTop;
                standing = true;
              }
            }
          }
        }
        (this.player as any).prevY = body.y;
        if (standing && topY !== Infinity) {
          body.y = topY - body.height;
          body.setVelocityY(0);
          body.touching.down = body.blocked.down = true;
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
          gravity: { y: 0, x: 0 },
          debug: false,
        },
      },
      scene: [GameScene],
      backgroundColor: '#87CEEB',
      pixelArt: true,
      antialias: false,
      render: {
        antialiasGL: false,
        pixelArt: true
      }
    };
    this.phaserGame = new Phaser.Game(cfg);
  }
  private handleControls(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite, t: number): void {
    const b = player.body as Phaser.Physics.Arcade.Body;
    if (!b) return;
    const ground = b.blocked.down || b.touching.down;
    const acc = 1500, airAcc = 1000, maxG = 200, maxA = 220, j = 320;
    const L = this.cursors.left.isDown;
    const R = this.cursors.right.isDown;
    const U = this.cursors.up.isDown;
    const D = this.cursors.down.isDown;
    const Z = this.keys["Z"].isDown;
    const jump = (this.cursors.up && Phaser.Input.Keyboard.JustDown(this.cursors.up)) ||
      (this.keys["Z"] && Phaser.Input.Keyboard.JustDown(this.keys["Z"]));
    const dash = this.keys["X"] && Phaser.Input.Keyboard.JustDown(this.keys["X"]);
    const atk = this.keys["C"] && Phaser.Input.Keyboard.JustDown(this.keys["C"]);
    const held = U || Z;
    if (jump) this.jumpBufferTime = t;
    if (ground) {
      this.canDoubleJump = this.dashAvailable = true;
      this.coyoteTime = t;
      if (t - this.jumpBufferTime < this.JUMP_BUFFER) {
        b.setVelocityY(-j);
        this.jumpBufferTime = 0;
      }
    }
    const canCoyote = t - this.coyoteTime < this.COYOTE_DURATION;
    if (this.isDashing) {
      if (t > this.dashTime + this.DASH_DURATION) {
        this.isDashing = false;
        b.setDragX(1000).setGravityY(800);
      } else {
        return;
      }
    }
    if (!this.isDashing) {
      const a = ground ? acc : airAcc;
      const lim = ground ? maxG : maxA;
      if (L) {
        b.setAccelerationX(-a);
        player.setFlipX(true);
        if (b.velocity.x < -lim) b.velocity.x = -lim;
      } else if (R) {
        b.setAccelerationX(a);
        player.setFlipX(false);
        if (b.velocity.x > lim) b.velocity.x = lim;
      } else {
        b.setAccelerationX(0);
        b.setDragX(ground ? 1500 : 500);
      }
      if (jump && t - this.jumpBufferTime < 50) {
        if (ground || canCoyote) {
          b.setVelocityY(-j);
          this.coyoteTime = 0;
        } else if (this.canDoubleJump) {
          b.setVelocityY(-j * 0.9);
          this.canDoubleJump = false;
        }
      }
      if (b.velocity.y < 0 && !held) {
        b.setVelocityY(b.velocity.y * 0.5);
      }
      if (b.velocity.y > 50 && !ground) {
        b.setGravityY(1000);
      } else if (b.velocity.y < 0) {
        b.setGravityY(700);
      } else {
        b.setGravityY(800);
      }
    }
    if (this.dashAvailable && !this.isDashing && dash) {
      this.dashAvailable = false;
      this.isDashing = true;
      this.dashTime = t;
      let dx = 0, dy = 0;
      if (U) dy = -1;
      if (D) dy = 1;
      if (L) dx = -1;
      if (R) dx = 1;
      if (!dx && !dy) dx = player.flipX ? -1 : 1;
      const len = Math.hypot(dx, dy);
      if (len) {
        dx /= len;
        dy /= len;
      }
      b.setVelocity(dx * this.DASH_SPEED, dy * this.DASH_SPEED)
        .setAcceleration(0)
        .setDrag(0)
        .setGravityY(0);
      const trail = scene.add.rectangle(player.x, player.y, 28, 21, 0xff6b6b, 0.5).setDepth(-1);
      scene.tweens.add({
        targets: trail,
        alpha: 0,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: this.DASH_DURATION,
        onComplete: () => trail.destroy()
      });
      if (this.gameScene) {
        const dashHitbox = scene.add.rectangle(player.x, player.y, 32, 24, 0xff6b6b, 0);
        scene.physics.add.existing(dashHitbox);
        (dashHitbox.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        (this.gameScene as any).playerDashHitbox = dashHitbox;
        scene.time.delayedCall(this.DASH_DURATION, () => {
          dashHitbox.destroy();
          (this.gameScene as any).playerDashHitbox = undefined;
        });
      }
    }
    if (atk) {
      const dir = player.flipX ? -1 : 1;
      let attackType: 'normal' | 'up' | 'down' = 'normal';
      let hitX = player.x + dir * 24;
      let hitY = player.y;
      let hitColor = 0xffff00; 
      if (U) {
        attackType = 'up';
        hitX = player.x;
        hitY = player.y - 28;
        hitColor = 0x00ffff; 
      } else if (D) {
        attackType = 'down';
        hitX = player.x;
        hitY = player.y + 28;
        hitColor = 0xff00ff; 
      }
      const hit = scene.add.rectangle(hitX, hitY, 32, 24, hitColor, 0.6);
      scene.physics.add.existing(hit);
      (hit.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true);
      (hit as any).attackType = attackType;
      if (this.gameScene) {
        (this.gameScene as any).playerHitboxes.push(hit);
      }
      scene.tweens.add({
        targets: hit,
        scaleX: 1.3,
        scaleY: 1.3,
        alpha: 0,
        duration: 120,
        ease: 'Power2'
      });
      scene.time.delayedCall(120, () => {
        hit.destroy();
        if (this.gameScene) {
          (this.gameScene as any).playerHitboxes = (this.gameScene as any).playerHitboxes.filter((h: any) => h !== hit);
        }
      });
    }
  }
}
