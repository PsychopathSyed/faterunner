import Phaser from 'phaser';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, set, get, query, orderByChild, limitToLast } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Add username handling
document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('username');
    const setUsernameButton = document.getElementById('set-username');
    
    setUsernameButton.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        if (username) {
            localStorage.setItem('username', username);
            // If the game is already running, update the username
            if (game.scene.scenes[0].username) {
                game.scene.scenes[0].username = username;
            }
        }
    });
    
    // Load saved username if available
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
        usernameInput.value = savedUsername;
    }
});

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.score = 0;
        this.difficulty = 1;
        this.userId = null;
        this.username = localStorage.getItem('username') || "Guest";
        this.challengeGoal = 1000;
    }

    preload() {
        this.load.image('player', 'assets/player.png');
        this.load.image('road', 'assets/road.png');
        this.load.image('obstacle', 'assets/obstacle.png');
        this.load.image('powerup', 'assets/powerup.png');
        this.load.image('rain', 'assets/rain.png');
    }

    create() {
        this.road = this.add.tileSprite(400, 300, 800, 600, 'road');
        this.player = this.physics.add.sprite(400, 500, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.setScale(0.5);

        this.cursors = this.input.keyboard.createCursorKeys();
        
        this.obstacles = this.physics.add.group();
        this.powerups = this.physics.add.group();

        this.physics.add.collider(this.player, this.obstacles, this.hitObstacle, null, this);
        this.physics.add.overlap(this.player, this.powerups, this.collectPowerup, null, this);

        this.time.addEvent({ delay: 2000, callback: this.spawnObstacle, callbackScope: this, loop: true });
        this.time.addEvent({ delay: 10000, callback: this.spawnPowerup, callbackScope: this, loop: true });

        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#fff' });
        this.challengeText = this.add.text(16, 50, `Challenge: Survive ${this.challengeGoal}`, { fontSize: '20px', fill: '#FFD700' });
        this.leaderboardText = this.add.text(550, 16, 'Leaderboard:\n', { fontSize: '20px', fill: '#fff' });
        
        this.authenticateUser();
        this.applyWeatherEffect();
    }

    update() {
        this.road.tilePositionY -= 5 * this.difficulty;

        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-200);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(200);
        } else {
            this.player.setVelocityX(0);
        }

        this.score += 1;
        this.scoreText.setText('Score: ' + this.score);
        if (this.score >= this.challengeGoal) {
            this.challengeText.setText("Challenge Completed!");
        }
        if (this.score % 500 === 0) {
            this.difficulty += 0.2;
        }
    }

    spawnObstacle() {
        let xPosition = Phaser.Math.Between(300, 500);
        let obstacle = this.obstacles.create(xPosition, 0, 'obstacle');
        obstacle.setVelocityY(200 * this.difficulty);
    }

    spawnPowerup() {
        let xPosition = Phaser.Math.Between(300, 500);
        let powerup = this.powerups.create(xPosition, 0, 'powerup');
        powerup.setVelocityY(150);
    }

    collectPowerup(player, powerup) {
        powerup.destroy();
        this.difficulty -= 0.5;
        this.time.delayedCall(5000, () => {
            this.difficulty += 0.5;
        });
    }

    hitObstacle(player, obstacle) {
        this.saveScore(this.score);
        this.scene.restart();
    }

    authenticateUser() {
        signInAnonymously(auth).then((userCredential) => {
            this.userId = userCredential.user.uid;
        }).catch((error) => {
            console.error("Authentication error: ", error);
        });
    }

    saveScore(score) {
        const scoresRef = ref(database, 'leaderboard/' + this.userId);
        set(scoresRef, { userId: this.userId, username: this.username, score: score });
        this.displayLeaderboard();
    }

    displayLeaderboard() {
        const leaderboardRef = query(ref(database, 'leaderboard'), orderByChild('score'), limitToLast(5));
        get(leaderboardRef).then((snapshot) => {
            if (snapshot.exists()) {
                let scores = [];
                snapshot.forEach((childSnapshot) => {
                    scores.push({ username: childSnapshot.val().username, score: childSnapshot.val().score });
                });
                scores.sort((a, b) => b.score - a.score);
                this.leaderboardText.setText('Leaderboard:\n' + scores.map((s, i) => `${i + 1}. ${s.username}: ${s.score}`).join('\n'));
            }
        });
    }

    applyWeatherEffect() {
        if (Phaser.Math.Between(0, 1)) {
            this.weatherEffect = this.add.tileSprite(400, 300, 800, 600, 'rain');
            this.weatherEffect.setAlpha(0.5);
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: MainScene
};

const game = new Phaser.Game(config);
