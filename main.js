import Phaser from 'phaser';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

let isHost = false;
let isSinglePlayer = false;
let roomCode = '';
let gameInstance = null;
let currentScene = null;

// Audio Setup
let audioInitialized = false;
let zzfx, zzfxV, zzfxX;

function initAudio() {
    if (audioInitialized) return;
    audioInitialized = true;
    zzfxV = 0.15;
    zzfxX = new (window.AudioContext || window.webkitAudioContext)();
    zzfx = (p=1,k=.05,b=220,e=0,r=0,t=.1,q=0,D=1,u=0,y=0,v=0,z=0,l=0,E=0,A=0,F=0,c=0,w=1,m=0,B=0)=>{let M=Math,R=44100,d=2*M.PI,G=u*=500*d/R/R,C=b*=(1-k+2*k*M.random(k=[]))*d/R,g=0,H=0,a=0,n=1,I=0,J=0,f=0,x,h;e=R*e+9;m*=R;r*=R;t*=R;c*=R;y*=500*d/R**3;A*=d/R;v*=d/R;z*=R;l=R*l|0;for(h=e+m+r+t+c|0;a<h;k[a++]=f)++J%(100*F|0)||(f=q?1<q?2<q?3<q?M.sin((g%d)**3):M.max(M.min(M.tan(g),1),-1):1-(2*g/d%2+2)%2:1-4*M.abs(M.round(g/d)-g/d):M.sin(g),f=(l?1-B+B*M.sin(d*a/l):1)*(0<f?1:-1)*M.abs(f)**D*p*zzfxV*(a<e?a/e:a<e+m?1-(a-e)/m*(1-w):a<e+m+r?w:a<h-c?(h-a-c)/t*w:0),f=c?f/2+(c>a?0:(a<h-c?1:(h-a)/c)*k[a-c|0]/2):f),x=(b+=u+=y)*M.cos(A*H++),g+=x-x*E*(1-1E9*(M.sin(a)+1)%2),n&&++n>z&&(b+=v,C+=v,n=0),!l||++I%l||(b=C,u=G,n=n||1);p=zzfxX.createBuffer(1,h,R);p.getChannelData(0).set(k);b=zzfxX.createBufferSource();b.buffer=p;b.connect(zzfxX.destination);b.start();return b};
}

const S_JUMP = [1,,250,.01,.01,.1,1,1.5];
const S_ZAP = [1,,500,.01,.01,.1,1,2];
const S_FIRE = [1.2,,100,.1,.1,.3,3,1.5];
const S_SHIELD = [1.2,,50,.05,.05,.2,4,2];
const S_HIT = [1,,200,.01,.01,.1,4,1.5];
const S_DIE = [1.5,,100,.2,.2,.6,4,1.5];

// UI Setup
const uiOverlay = document.getElementById('ui-overlay');
const menu = document.getElementById('menu');
const lobby = document.getElementById('lobby');
const roomCodeDisplay = document.getElementById('room-code');
const errorMsg = document.getElementById('error-msg');
const inputCode = document.getElementById('input-code');

document.getElementById('btn-singleplayer').addEventListener('click', () => {
    initAudio();
    isSinglePlayer = true;
    isHost = true;
    uiOverlay.style.display = 'none';
    if (!gameInstance) {
        gameInstance = new Phaser.Game(config);
    } else {
        if (currentScene) currentScene.scene.restart();
    }
});

document.getElementById('btn-create').addEventListener('click', () => {
    initAudio();
    isSinglePlayer = false;
    socket.emit('createMatch');
});

document.getElementById('btn-join').addEventListener('click', () => {
    initAudio();
    isSinglePlayer = false;
    const code = inputCode.value.toUpperCase();
    if (code.length === 4) {
        socket.emit('joinMatch', code);
    } else {
        errorMsg.innerText = "Code must be 4 letters.";
    }
});

socket.on('matchCreated', (code) => {
    isHost = true;
    roomCode = code;
    menu.style.display = 'none';
    lobby.style.display = 'block';
    roomCodeDisplay.innerText = code;
});

socket.on('joinSuccess', (code) => {
    isHost = false;
    roomCode = code;
    menu.style.display = 'none';
    lobby.style.display = 'block';
    roomCodeDisplay.innerText = "Joining...";
});

socket.on('joinError', (msg) => {
    errorMsg.innerText = msg;
});

socket.on('startGame', (data) => {
    uiOverlay.style.display = 'none';
    if (!gameInstance) {
        gameInstance = new Phaser.Game(config);
    } else {
        if (currentScene) currentScene.scene.restart();
    }
});

socket.on('opponentDisconnected', () => {
    if (currentScene) {
        currentScene.winText.setText("Opponent Disconnected.");
        currentScene.winText.setVisible(true);
        currentScene.isGameOver = true;
    }
});

let guestInputState = { up: false, left: false, down: false, right: false, dash: false, zap: false, fireball: false, shield: false };

socket.on('guestInput', (input) => {
    guestInputState = input;
});

// Sync state from Host to Guest
socket.on('syncState', (state) => {
    if (currentScene && !isHost && !isSinglePlayer) {
        currentScene.syncFromServer(state);
    }
});

function updateBotAI(scene, delta) {
    if (!isSinglePlayer) return;
    let bot = scene.player2;
    let player = scene.player1;
    
    // Reset inputs
    guestInputState = { up: false, left: false, down: false, right: false, dash: false, zap: false, fireball: false, shield: false };
    
    let targetX = player.x;
    let targetY = player.y;

    // Horizontal Movement (Easy: Large deadzone so it stops far away)
    if (bot.x < targetX - 150) guestInputState.right = true;
    else if (bot.x > targetX + 150) guestInputState.left = true;

    // Vertical Movement (Jumping)
    if (bot.body.touching.down && targetY < bot.y - 150 && Math.random() < 0.1) {
        guestInputState.up = true;
    }
    
    // Dodge Incoming Spells (Easy: rarely notices danger)
    let incomingDanger = false;
    if (Math.random() < 0.1) {
        scene.spells.getChildren().forEach(s => {
            if (s.ownerId === 1 && Math.abs(s.y - bot.y) < 50) {
                let movingTowards = (s.body.velocity.x > 0 && s.x < bot.x) || (s.body.velocity.x < 0 && s.x > bot.x);
                if (movingTowards && Phaser.Math.Distance.Between(s.x, s.y, bot.x, bot.y) < 200) {
                    incomingDanger = true;
                }
            }
        });
    }

    if (incomingDanger) {
        if (bot.mana >= 30) {
            guestInputState.shield = true;
        } else if (bot.body.touching.down) {
            guestInputState.up = true;
        }
    }

    // Attacking (Easy: 1% chance per frame to even consider attacking)
    if (!incomingDanger && Math.random() < 0.01 && Math.abs(bot.y - player.y) < 100 && Phaser.Math.Distance.Between(bot.x, bot.y, player.x, player.y) < 600) {
        // Face player
        if (bot.x < player.x) guestInputState.right = true;
        else guestInputState.left = true;

        if (bot.mana >= 40 && Math.random() < 0.3) {
            guestInputState.fireball = true;
        } else if (bot.mana >= 15 && Phaser.Math.Distance.Between(bot.x, bot.y, player.x, player.y) < 300 && Math.random() < 0.5) {
            guestInputState.zap = true;
        }
    }
    
    // Occasional Dash (Easy: rarely dashes)
    if (Math.random() < 0.001) guestInputState.dash = true;
}

// --- GAME LOGIC ---

class Spell extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture, damage, speed, color, isZap, ownerId) {
        super(scene, x, y, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setTint(color);
        this.damage = damage;
        this.speed = speed;
        this.isZap = isZap;
        this.ownerId = ownerId;
        
        if (isZap) {
            this.lifespan = 300;
            this.setScale(2, 2);
            this.body.setSize(this.width * 2, this.height * 2);
        } else {
            this.lifespan = 3000;
            this.setScale(1.5, 1.5);
            this.body.setSize(this.width * 1.5, this.height * 1.5);
        }
        
        this.body.setAllowGravity(false);
    }
    
    update(time, delta) {
        this.lifespan -= delta;
        if (this.lifespan <= 0) {
            this.die();
        }
    }
    
    die() {
        if (this.emitter) {
            this.emitter.stop();
            this.scene.time.delayedCall(1000, () => this.emitter.destroy());
        }
        if (!this.isZap) {
            let explosion = this.scene.add.particles(this.x, this.y, 'spark', {
                speed: { min: 50, max: 150 },
                scale: { start: 1, end: 0 },
                blendMode: 'ADD',
                lifespan: 200,
                quantity: 10,
                duration: 50
            });
            this.scene.time.delayedCall(500, () => explosion.destroy());
        }
        this.destroy();
    }
}

class Shield extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, ownerId) {
        super(scene, x, y, 'wizard'); 
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setTint(0x8B4513); 
        this.ownerId = ownerId;
        this.lifespan = 5000; 
        
        this.body.setAllowGravity(false);
        this.body.setImmovable(true);
        this.setScale(1, 1.5);
    }
    
    update(time, delta) {
        this.lifespan -= delta;
        if (this.lifespan <= 0) {
            this.die();
        }
    }
    
    die() {
        let debris = this.scene.add.particles(this.x, this.y, 'spark', {
            speed: { min: 50, max: 200 },
            scale: { start: 2, end: 0 },
            tint: 0x8B4513,
            lifespan: 400,
            quantity: 20,
            duration: 50,
            gravityY: 400
        });
        this.scene.time.delayedCall(1000, () => debris.destroy());
        this.destroy();
    }
}

class Wizard extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, color, controls, name, isPlayer1) {
        let spriteKey = isPlayer1 ? 'blue_wiz' : 'red_wiz';
        super(scene, x, y, spriteKey);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.setScale(isPlayer1 ? 0.35 : 0.31);
        this.body.setSize(150, 280);
        this.body.setOffset(isPlayer1 ? 110 : 135, isPlayer1 ? 50 : 110);
        
        this.setCollideWorldBounds(true);
        this.setBounce(0);

        this.controls = controls;
        this.speed = 250;
        this.jumpForce = -600;
        
        this.isDashing = false;
        this.dashSpeed = 800;
        this.dashTime = 0;
        this.dashDuration = 150;
        this.dashCooldown = 1000;
        this.lastDash = 0;
        this.lastGhost = 0;
        
        this.facingRight = isPlayer1;
        this.hp = 100;
        this.mana = 100;
        this.name = name;
        this.color = color;
        this.isPlayer1 = isPlayer1;
        this.isCasting = false;
        
        this.zapCooldown = 1000;
        this.lastZap = 0;
        this.fireballCooldown = 2000;
        this.lastFireball = 0;
        this.shieldCooldown = 3000;
        this.lastShield = 0;
        
        if (!isHost) {
            this.body.setAllowGravity(false);
            this.body.setImmovable(true);
        }
    }

    update(time, delta) {
        if (this.hp <= 0) return; 
        
        // Ghost trail for dashing
        if (this.isDashing && time > this.lastGhost + 30) {
            this.lastGhost = time;
            let ghost = this.scene.add.sprite(this.x, this.y, 'ghost');
            ghost.setTint(this.color);
            this.scene.tweens.add({
                targets: ghost,
                alpha: 0,
                duration: 200,
                onComplete: () => ghost.destroy()
            });
        }

        // Animation and facing logic
        let prefix = this.isPlayer1 ? 'blue_' : 'red_';
        
        if (this.isCasting) {
             if (this.anims.currentAnim && this.anims.currentAnim.key === prefix + 'cast' && this.anims.isPlaying) {
                 // still casting
             } else {
                 this.isCasting = false;
             }
        }

        if (!this.isCasting && !this.isDashing) {
            if (this.body.velocity.x !== 0) {
                this.anims.play(prefix + 'run', true);
            } else {
                this.anims.play(prefix + 'idle', true);
            }
        }
        
        this.setFlipX(!this.facingRight);

        // Host handles physics and logic
        if (isHost) {
            this.mana += 5 * (delta / 1000);
            if (this.mana > 100) this.mana = 100;
            
            // Resolve inputs (local for P1, network for P2)
            let currentInput = this.isPlayer1 ? {
                up: this.controls.up.isDown,
                left: this.controls.left.isDown,
                down: this.controls.down.isDown,
                right: this.controls.right.isDown,
                dash: Phaser.Input.Keyboard.JustDown(this.controls.dash),
                zap: Phaser.Input.Keyboard.JustDown(this.controls.zap),
                fireball: Phaser.Input.Keyboard.JustDown(this.controls.fireball),
                shield: Phaser.Input.Keyboard.JustDown(this.controls.shield)
            } : guestInputState;
            
            if (this.isDashing) {
                if (time > this.dashTime) {
                    this.isDashing = false;
                    this.body.setAllowGravity(true);
                } else {
                    this.setVelocityX(this.facingRight ? this.dashSpeed : -this.dashSpeed);
                    this.setVelocityY(0);
                    return;
                }
            }

            if (currentInput.left) {
                this.setVelocityX(-this.speed);
                this.facingRight = false;
            } else if (currentInput.right) {
                this.setVelocityX(this.speed);
                this.facingRight = true;
            } else {
                this.setVelocityX(0);
            }

            if (currentInput.up && this.body.touching.down) {
                this.setVelocityY(this.jumpForce);
                this.scene.spawnJumpDust(this.x, this.y);
                if (audioInitialized) zzfx(...S_JUMP);
            }

            if (currentInput.dash && !this.isDashing && time > this.lastDash + this.dashCooldown) {
                this.isDashing = true;
                this.dashTime = time + this.dashDuration;
                this.lastDash = time;
                this.body.setAllowGravity(false);
                this.scene.cameras.main.shake(50, 0.002);
            }

            if (currentInput.zap && time > this.lastZap + this.zapCooldown && this.mana >= 15) {
                this.mana -= 15;
                this.lastZap = time;
                this.castZap();
            }
            if (currentInput.fireball && time > this.lastFireball + this.fireballCooldown && this.mana >= 40) {
                this.mana -= 40;
                this.lastFireball = time;
                this.castFireball();
            }
            if (currentInput.shield && time > this.lastShield + this.shieldCooldown && this.mana >= 30) {
                this.mana -= 30;
                this.lastShield = time;
                this.castShield();
            }
            
            // Clear single-frame network inputs for guest after processing
            if (!this.isPlayer1) {
                guestInputState.dash = false;
                guestInputState.zap = false;
                guestInputState.fireball = false;
                guestInputState.shield = false;
            }
            
        } else {
            // Guest logic: send inputs to server
            if (!this.isPlayer1) { // We are playing P2
                let input = {
                    up: this.controls.up.isDown,
                    left: this.controls.left.isDown,
                    down: this.controls.down.isDown,
                    right: this.controls.right.isDown,
                    dash: Phaser.Input.Keyboard.JustDown(this.controls.dash),
                    zap: Phaser.Input.Keyboard.JustDown(this.controls.zap),
                    fireball: Phaser.Input.Keyboard.JustDown(this.controls.fireball),
                    shield: Phaser.Input.Keyboard.JustDown(this.controls.shield)
                };
                socket.emit('sendInput', { roomCode, ...input });
            }
        }
    }
    
    castZap() {
        this.isCasting = true;
        this.anims.play((this.isPlayer1 ? 'blue_' : 'red_') + 'cast', true);
        if (audioInitialized) zzfx(...S_ZAP);
        let xOffset = this.facingRight ? 50 : -50;
        let ownerId = this.isPlayer1 ? 1 : 2;
        let zap = new Spell(this.scene, this.x + xOffset, this.y, 'zap', 5, 0, 0xffff00, true, ownerId);
        let zapSpeed = this.facingRight ? 1200 : -1200;
        this.scene.spells.add(zap);
        zap.body.setAllowGravity(false);
        zap.setVelocityX(zapSpeed);
        this.scene.networkEvents.push({ type: 'zap', x: zap.x, y: zap.y, ownerId, vX: zapSpeed });
    }
    
    castFireball() {
        this.isCasting = true;
        this.anims.play((this.isPlayer1 ? 'blue_' : 'red_') + 'cast', true);
        if (audioInitialized) zzfx(...S_FIRE);
        let xOffset = this.facingRight ? 50 : -50;
        let ownerId = this.isPlayer1 ? 1 : 2;
        let fireball = new Spell(this.scene, this.x + xOffset, this.y, 'fireball', 20, 0, 0xff8800, false, ownerId);
        let fbSpeed = this.facingRight ? 500 : -500;
        this.scene.spells.add(fireball);
        fireball.body.setAllowGravity(false);
        fireball.setVelocityX(fbSpeed);
        
        let emitter = this.scene.add.particles(0, 0, 'spark', {
            speed: 20,
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            tint: 0xff4400,
            lifespan: 300
        });
        emitter.startFollow(fireball);
        fireball.emitter = emitter;
        
        this.scene.networkEvents.push({ type: 'fireball', x: fireball.x, y: fireball.y, ownerId, vX: fbSpeed });
    }
    
    castShield() {
        this.isCasting = true;
        this.anims.play((this.isPlayer1 ? 'blue_' : 'red_') + 'cast', true);
        if (audioInitialized) zzfx(...S_SHIELD);
        let xOffset = this.facingRight ? 40 : -40;
        let ownerId = this.isPlayer1 ? 1 : 2;
        let shield = new Shield(this.scene, this.x + xOffset, this.y, ownerId);
        this.scene.shields.add(shield);
        
        let fx = this.scene.add.particles(shield.x, shield.y, 'spark', {
            speed: { min: 100, max: 200 },
            scale: { start: 1.5, end: 0 },
            tint: 0x8B4513,
            lifespan: 200,
            quantity: 15,
            duration: 50
        });
        this.scene.time.delayedCall(500, () => fx.destroy());
        this.scene.networkEvents.push({ type: 'shield', x: shield.x, y: shield.y, ownerId });
    }
    
    takeDamage(amount) {
        if (this.hp <= 0) return;
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
        
        this.setTintFill(0xffffff);
        if (audioInitialized) zzfx(...S_HIT);
        this.scene.time.delayedCall(100, () => {
            if(this.active) {
                this.clearTint();
                this.setTint(this.color);
            }
        });
        
        this.scene.cameras.main.shake(150, 0.01);
        
        let blood = this.scene.add.particles(this.x, this.y, 'spark', {
            speed: { min: 50, max: 150 },
            scale: { start: 1, end: 0 },
            tint: 0xffffff,
            lifespan: 200,
            quantity: 10,
            duration: 50
        });
        this.scene.time.delayedCall(500, () => blood.destroy());
        
        if (this.hp <= 0) {
            if (audioInitialized) zzfx(...S_DIE);
            this.anims.play((this.isPlayer1 ? 'blue_' : 'red_') + 'die', true);
            this.scene.handleDeath(this);
            if (isHost) this.setVelocityX(0);
        }
    }
}

class DuelScene extends Phaser.Scene {
    constructor() {
        super('DuelScene');
        this.p1Wins = 0;
        this.p2Wins = 0;
        this.networkEvents = [];
        this.roundTimer = 60;
        this.potionTimer = 0;
    }

    preload() {
        this.load.audio('bgm', 'bg_music.mp3');
        this.load.image('bg', 'duel_bg_clean.png');
        this.load.spritesheet('blue_wiz', 'blue_wiz_clean.png', { frameWidth: 374, frameHeight: 333 });
        this.load.spritesheet('red_wiz', 'red_wiz_clean.png', { frameWidth: 425, frameHeight: 397 });
        
        let gfx = this.make.graphics({x: 0, y: 0, add: false});
        gfx.fillStyle(0xffffff, 1);
        gfx.fillRect(0, 0, 32, 48);
        gfx.generateTexture('wizard', 32, 48);
        
        gfx.clear();
        gfx.fillStyle(0xffffff, 1);
        gfx.fillRect(0, 0, 50, 15);
        gfx.generateTexture('zap', 50, 15);

        gfx.clear();
        gfx.fillStyle(0xffffff, 1);
        gfx.fillCircle(25, 25, 25);
        gfx.generateTexture('fireball', 50, 50);
        
        gfx.clear();
        gfx.fillStyle(0xffffff, 1);
        gfx.fillRect(0, 0, 4, 4);
        gfx.generateTexture('spark', 4, 4);
        
        gfx.clear();
        gfx.fillStyle(0xffffff, 0.5);
        gfx.fillRect(0, 0, 32, 48);
        gfx.generateTexture('ghost', 32, 48);
        
        gfx.clear();
        gfx.fillStyle(0xddddff, 0.7);
        gfx.fillCircle(40, 20, 20);
        gfx.fillCircle(20, 30, 20);
        gfx.fillCircle(60, 30, 20);
        gfx.fillCircle(80, 20, 20);
        gfx.generateTexture('cloud', 100, 50);

        gfx.clear();
        gfx.fillStyle(0xff2222, 1);
        gfx.fillRect(5, 10, 10, 10);
        gfx.fillRect(8, 0, 4, 10);
        gfx.generateTexture('potion_red', 20, 20);

        gfx.clear();
        gfx.fillStyle(0x0088ff, 1);
        gfx.fillRect(5, 10, 10, 10);
        gfx.fillRect(8, 0, 4, 10);
        gfx.generateTexture('potion_blue', 20, 20);
    }

    create() {
        currentScene = this;
        this.isGameOver = false;
        
        // Ensure bgm is not playing twice if restarting
        if (!this.sound.get('bgm') || !this.sound.get('bgm').isPlaying) {
            this.sound.play('bgm', { loop: true, volume: 0.2 });
        }
        
        this.add.image(0, 0, 'bg').setOrigin(0, 0);
        
        this.anims.create({ key: 'blue_idle', frames: this.anims.generateFrameNumbers('blue_wiz', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'blue_run', frames: this.anims.generateFrameNumbers('blue_wiz', { start: 9, end: 17 }), frameRate: 15, repeat: -1 });
        this.anims.create({ key: 'blue_cast', frames: this.anims.generateFrameNumbers('blue_wiz', { start: 18, end: 22 }), frameRate: 15, repeat: 0 });
        this.anims.create({ key: 'blue_die', frames: this.anims.generateFrameNumbers('blue_wiz', { start: 27, end: 30 }), frameRate: 8, repeat: 0 });
        
        this.anims.create({ key: 'red_idle', frames: this.anims.generateFrameNumbers('red_wiz', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'red_run', frames: this.anims.generateFrameNumbers('red_wiz', { start: 6, end: 11 }), frameRate: 12, repeat: -1 });
        this.anims.create({ key: 'red_cast', frames: this.anims.generateFrameNumbers('red_wiz', { start: 12, end: 17 }), frameRate: 15, repeat: 0 });
        this.anims.create({ key: 'red_die', frames: this.anims.generateFrameNumbers('red_wiz', { start: 18, end: 21 }), frameRate: 8, repeat: 0 });

        this.platforms = this.physics.add.staticGroup();
        this.platforms.add(this.add.rectangle(400, 580, 800, 40, 0x334433));
        
        this.clouds = this.physics.add.group({ allowGravity: false, immovable: true });
        
        if (isHost) {
            let c1 = this.clouds.create(200, 400, 'cloud');
            c1.setVelocityX(50);
            c1.cloudId = 1;
            let c2 = this.clouds.create(600, 400, 'cloud');
            c2.setVelocityX(-50);
            c2.cloudId = 2;
            let c3 = this.clouds.create(400, 250, 'cloud');
            c3.setVelocityX(60);
            c3.cloudId = 3;
        } else {
            // Guest will create clouds from network state
            for(let i=1; i<=3; i++) {
                let c = this.clouds.create(-100, -100, 'cloud');
                c.cloudId = i;
            }
        }

        // Use WASD for local player regardless of host/guest
        const localKeys = {
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            dash: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
            zap: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
            fireball: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G),
            shield: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H)
        };
        
        // Host plays P1, Guest plays P2
        this.player1 = new Wizard(this, 100, 400, 0x0088ff, isHost ? localKeys : null, 'Player 1 (Blue)', true);
        this.player2 = new Wizard(this, 700, 400, 0xff2222, isHost ? null : localKeys, 'Player 2 (Red)', false);

        this.spells = this.physics.add.group({ allowGravity: false });
        this.shields = this.physics.add.group({ allowGravity: false, immovable: true });
        this.potions = this.physics.add.group();

        if (isHost) {
            this.roundTimer = 60;
            this.potionTimer = 0;
            
            this.physics.add.collider(this.player1, this.platforms);
            this.physics.add.collider(this.player2, this.platforms);
            this.physics.add.collider(this.player1, this.clouds);
            this.physics.add.collider(this.player2, this.clouds);
            this.physics.add.collider(this.potions, this.platforms);
            this.physics.add.collider(this.potions, this.clouds);
            this.physics.add.collider(this.player1, this.player2);
            
            this.physics.add.collider(this.player1, this.shields);
            this.physics.add.collider(this.player2, this.shields);
            
            this.physics.add.collider(this.spells, this.platforms, (spell, platform) => {
                if (!spell.isZap) {
                    spell.die();
                    this.networkEvents.push({ type: 'spellDie', id: spell.id });
                }
            });
            
            this.physics.add.overlap(this.spells, this.shields, (spell, shield) => {
                if (spell.ownerId !== shield.ownerId) {
                    if (!spell.isZap) spell.die();
                    shield.die();
                    this.cameras.main.shake(100, 0.005);
                }
            });
            
            this.physics.add.overlap(this.spells, this.player1, (player, spell) => {
                if (spell.ownerId !== 1) {
                    player.takeDamage(spell.damage);
                    if (!spell.isZap) spell.die();
                }
            });
            
            this.physics.add.overlap(this.spells, this.player2, (player, spell) => {
                if (spell.ownerId !== 2) {
                    player.takeDamage(spell.damage);
                    if (!spell.isZap) spell.die();
                }
            });
            
            this.physics.add.overlap(this.potions, this.player1, (player, potion) => {
                this.collectPotion(player, potion);
            });
            
            this.physics.add.overlap(this.potions, this.player2, (player, potion) => {
                this.collectPotion(player, potion);
            });
        }

        // UI setup
        this.add.text(400, 10, "Rupert's Duel Club - MULTIPLAYER", { fontSize: '24px', fill: '#ffffff' }).setOrigin(0.5);
        
        this.p1HpText = this.add.text(20, 10, "P1 HP: 100", { fontSize: '18px', fill: '#0088ff', fontStyle: 'bold' });
        this.p1ManaText = this.add.text(20, 30, "Mana: 100", { fontSize: '14px', fill: '#8888ff' });
        this.p1WinsText = this.add.text(20, 50, `Wins: ${this.p1Wins}`, { fontSize: '16px', fill: '#ffffff' });
        
        this.p2HpText = this.add.text(780, 10, "P2 HP: 100", { fontSize: '18px', fill: '#ff2222', fontStyle: 'bold' }).setOrigin(1, 0);
        this.p2ManaText = this.add.text(780, 30, "Mana: 100", { fontSize: '14px', fill: '#ff8888' }).setOrigin(1, 0);
        this.p2WinsText = this.add.text(780, 50, `Wins: ${this.p2Wins}`, { fontSize: '16px', fill: '#ffffff' }).setOrigin(1, 0);
        
        this.add.text(400, 570, "Move: WASD | Dash: SHIFT | Zap: F | Fireball: G | Shield: H", { fontSize: '14px', fill: '#cccccc' }).setOrigin(0.5);

        this.timerText = this.add.text(400, 50, "60", { fontSize: '32px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

        this.winText = this.add.text(400, 300, "", { fontSize: '48px', fill: '#ffff00', backgroundColor: '#000000aa', padding: { x: 20, y: 10 } }).setOrigin(0.5);
        this.winText.setVisible(false);
    }

    spawnJumpDust(x, y) {
        let dust = this.add.particles(x, y + 24, 'spark', {
            speedX: { min: -50, max: 50 },
            speedY: { min: -20, max: 0 },
            scale: { start: 1, end: 0 },
            tint: 0x888888,
            lifespan: 300,
            quantity: 5,
            duration: 50
        });
        this.time.delayedCall(500, () => dust.destroy());
    }

    collectPotion(player, potion) {
        if (potion.type === 'red') {
            player.hp = Math.min(100, player.hp + 30);
        } else {
            player.mana = Math.min(100, player.mana + 50);
        }
        if (audioInitialized) zzfx(...S_SHIELD);
        this.networkEvents.push({ type: 'potionCollect', potionId: potion.id, playerId: player.isPlayer1 ? 1 : 2 });
        potion.destroy();
    }

    update(time, delta) {
        if (this.isGameOver) return;
        
        this.player1.update(time, delta);
        this.player2.update(time, delta);
        
        this.spells.getChildren().forEach(spell => spell.update(time, delta));
        this.shields.getChildren().forEach(shield => shield.update(time, delta));
        
        this.p1HpText.setText(`P1 HP: ${this.player1.hp}`);
        this.p1ManaText.setText(`Mana: ${Math.floor(this.player1.mana)}`);
        
        this.p2HpText.setText(`P2 HP: ${this.player2.hp}`);
        this.p2ManaText.setText(`Mana: ${Math.floor(this.player2.mana)}`);
        
        if (isHost) {
            if (isSinglePlayer) {
                updateBotAI(this, delta);
            }
            
            this.roundTimer -= delta / 1000;
            if (this.roundTimer <= 0) {
                this.roundTimer = 0;
                this.handleTimeout();
            }
            this.timerText.setText(Math.ceil(this.roundTimer));
            
            this.clouds.getChildren().forEach(c => {
                if (c.x < 100 && c.body.velocity.x < 0) c.setVelocityX(Math.abs(c.body.velocity.x));
                if (c.x > 700 && c.body.velocity.x > 0) c.setVelocityX(-Math.abs(c.body.velocity.x));
            });
            
            this.potionTimer += delta;
            if (this.potionTimer > 15000) {
                this.potionTimer = 0;
                let isRed = Math.random() > 0.5;
                let px = 100 + Math.random() * 600;
                let potion = this.potions.create(px, 50, isRed ? 'potion_red' : 'potion_blue');
                potion.type = isRed ? 'red' : 'blue';
                potion.id = Math.floor(Math.random() * 1000000);
                potion.setBounce(0.5);
                this.networkEvents.push({ type: 'spawnPotion', x: px, potionType: potion.type, id: potion.id });
            }

            let cloudData = this.clouds.getChildren().map(c => ({ id: c.cloudId, x: c.x, y: c.y }));
            
            let state = {
                roomCode,
                timer: this.roundTimer,
                clouds: cloudData,
                p1: { x: this.player1.x, y: this.player1.y, facingRight: this.player1.facingRight, hp: this.player1.hp, mana: this.player1.mana, isDashing: this.player1.isDashing, isCasting: this.player1.isCasting },
                p2: { x: this.player2.x, y: this.player2.y, facingRight: this.player2.facingRight, hp: this.player2.hp, mana: this.player2.mana, isDashing: this.player2.isDashing, isCasting: this.player2.isCasting },
                events: this.networkEvents
            };
            
            if (!isSinglePlayer) {
                socket.emit('syncState', state);
            }
            this.networkEvents = []; // Clear after sending
        }
    }
    
    syncFromServer(state) {
        // Only Guest processes this
        this.timerText.setText(Math.ceil(state.timer));
        
        state.clouds.forEach(cd => {
            let c = this.clouds.getChildren().find(cl => cl.cloudId === cd.id);
            if (c) c.setPosition(cd.x, cd.y);
        });
        
        this.player1.setPosition(state.p1.x, state.p1.y);
        this.player1.facingRight = state.p1.facingRight;
        this.player1.isDashing = state.p1.isDashing;
        this.player1.isCasting = state.p1.isCasting;
        
        // Only update HP/Mana if it changes to trigger damage effect
        if (this.player1.hp > state.p1.hp) this.player1.takeDamage(this.player1.hp - state.p1.hp);
        this.player1.hp = state.p1.hp;
        this.player1.mana = state.p1.mana;
        
        this.player2.setPosition(state.p2.x, state.p2.y);
        this.player2.facingRight = state.p2.facingRight;
        this.player2.isDashing = state.p2.isDashing;
        this.player2.isCasting = state.p2.isCasting;
        
        if (this.player2.hp > state.p2.hp) this.player2.takeDamage(this.player2.hp - state.p2.hp);
        this.player2.hp = state.p2.hp;
        this.player2.mana = state.p2.mana;
        
        // Process visual events
        state.events.forEach(ev => {
            if (ev.type === 'zap') {
                if (audioInitialized) zzfx(...S_ZAP);
                let zap = new Spell(this, ev.x, ev.y, 'zap', 5, 0, 0xffff00, true, ev.ownerId);
                this.spells.add(zap);
                zap.body.setAllowGravity(false);
                zap.setVelocityX(ev.vX);
            }
            if (ev.type === 'fireball') {
                if (audioInitialized) zzfx(...S_FIRE);
                let fireball = new Spell(this, ev.x, ev.y, 'fireball', 20, 0, ev.ownerId === 1 ? 0xff8800 : 0xff4400, false, ev.ownerId);
                this.spells.add(fireball);
                fireball.body.setAllowGravity(false);
                fireball.setVelocityX(ev.vX);
                
                let emitter = this.add.particles(0, 0, 'spark', {
                    speed: 20,
                    scale: { start: 1, end: 0 },
                    blendMode: 'ADD',
                    tint: 0xff4400,
                    lifespan: 300
                });
                emitter.startFollow(fireball);
                fireball.emitter = emitter;
            }
            if (ev.type === 'shield') {
                if (audioInitialized) zzfx(...S_SHIELD);
                let shield = new Shield(this, ev.x, ev.y, ev.ownerId);
                this.shields.add(shield);
                
                let fx = this.add.particles(shield.x, shield.y, 'spark', {
                    speed: { min: 100, max: 200 },
                    scale: { start: 1.5, end: 0 },
                    tint: 0x8B4513,
                    lifespan: 200,
                    quantity: 15,
                    duration: 50
                });
                this.time.delayedCall(500, () => fx.destroy());
            }
            if (ev.type === 'spawnPotion') {
                let potion = this.potions.create(ev.x, 50, ev.potionType === 'red' ? 'potion_red' : 'potion_blue');
                potion.id = ev.id;
            }
            if (ev.type === 'potionCollect') {
                if (audioInitialized) zzfx(...S_SHIELD);
                let p = this.potions.getChildren().find(p => p.id === ev.potionId);
                if (p) p.destroy();
            }
            if (ev.type === 'spellDie') {
                let s = this.spells.getChildren().find(sp => sp.id === ev.id);
                if (s) s.die();
            }
            if (ev.type === 'timeout') {
                this.handleTimeout();
            }
        });
    }
    
    handleTimeout() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.cameras.main.shake(100, 0.01);
        
        if (this.player1.hp > this.player2.hp) {
            this.winText.setText("TIME UP!\nBlue Wins by HP!");
            this.p1Wins++;
        } else if (this.player2.hp > this.player1.hp) {
            this.winText.setText("TIME UP!\nRed Wins by HP!");
            this.p2Wins++;
        } else {
            this.winText.setText("TIME UP!\nDRAW!");
        }
        
        this.winText.setVisible(true);
        this.p1WinsText.setText(`Wins: ${this.p1Wins}`);
        this.p2WinsText.setText(`Wins: ${this.p2Wins}`);
        
        if (isHost) {
            if (!isSinglePlayer) {
                this.networkEvents.push({ type: 'timeout' });
            }
            this.time.delayedCall(4000, () => this.scene.restart());
        }
    }

    handleDeath(loser) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        
        this.cameras.main.shake(300, 0.02);
        
        let winner = loser === this.player1 ? this.player2 : this.player1;
        this.winText.setText(`${winner.name} wins the round!`);
        this.winText.setVisible(true);
        
        if (winner === this.player1) this.p1Wins++;
        if (winner === this.player2) this.p2Wins++;
        
        this.p1WinsText.setText(`Wins: ${this.p1Wins}`);
        this.p2WinsText.setText(`Wins: ${this.p2Wins}`);
        
        if (isHost) {
            if (!isSinglePlayer) {
                socket.emit('playerDied', roomCode);
            }
            if (this.p1Wins >= 3 || this.p2Wins >= 3) {
                this.winText.setText(`${winner.name} IS THE CHAMPION!`);
                this.time.delayedCall(4000, () => {
                    this.p1Wins = 0;
                    this.p2Wins = 0;
                    this.scene.restart();
                });
            } else {
                this.time.delayedCall(2500, () => {
                    this.scene.restart();
                });
            }
        } else {
            if (this.p1Wins >= 3 || this.p2Wins >= 3) {
                this.winText.setText(`${winner.name} IS THE CHAMPION!`);
            }
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 1200 },
            debug: false
        }
    },
    scene: DuelScene
};

// Don't auto-start scenes, wait for lobby
