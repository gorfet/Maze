class MazeGame {
    constructor() {
        this.torchRadius = 2; 
        this.standingStillTime = 0; 
        this.lastPlayerPos = {x: 0, y: 0};
        this.currentStage = 1;
        this.mazeSize = 5 + this.currentStage * 2;
        this.playerPos = {x:0, y:0};
        this.exitPos = {x:0, y:0};
        this.monsterPos = {x:0, y:0};
        this.visited = new Set();
        this.mazeGrid = [];
        this.monsterInterval = null;

        this.bindUI();
        this.init();
    }

    bindUI() {
        document.getElementById('playButton').addEventListener('click', () => this.startGame());
        document.getElementById('exitButton').addEventListener('click', () => this.exitGame());

        ['up','down','left','right'].forEach(dir => {
            const btn = document.getElementById(dir);
            const moves = {up:[0,-1], down:[0,1], left:[-1,0], right:[1,0]};
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.movePlayer(...moves[dir]);
            });
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.movePlayer(...moves[dir]);
            });
        });
    }

    init() {
        this.generateMaze();
        this.setupControls();
        this.updateStageDisplay();
        this.startBackgroundMusic();
    }

    startGame() {
        document.getElementById('menu').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        this.spawnMonster();
    }

    exitGame() {
        location.reload();
    }

    generateMaze() {
        this.mazeSize = 10 + this.currentStage * 2;
        this.mazeGrid = Array(this.mazeSize).fill(null).map(() =>
            Array(this.mazeSize).fill(null).map(() => ({
                walls: {top:true, right:true, bottom:true, left:true},
                fog: true
            }))
        );

        const stack = [];
        let current = {x:0, y:0};
        this.visited.clear();
        this.visited.add(`${current.x},${current.y}`);

        while (true) {
            const neighbors = this.getUnvisitedNeighbors(current);
            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random()*neighbors.length)];
                this.removeWall(current, next);
                stack.push(current);
                current = next;
                this.visited.add(`${current.x},${current.y}`);
            } else if (stack.length > 0) {
                current = stack.pop();
            } else {
                break;
            }
        }

        this.playerPos = {x:0, y:0};
        this.exitPos = {x:this.mazeSize-1, y:this.mazeSize-1};

        this.drawMaze();
        this.updateFog();
        this.updatePlayerPosition();
    }

    spawnMonster() {
        clearInterval(this.monsterInterval);
        do {
            this.monsterPos = {
                x: Math.floor(Math.random()*this.mazeSize),
                y: Math.floor(Math.random()*this.mazeSize)
            };
        } while (this.monsterPos.x === this.playerPos.x && this.monsterPos.y === this.playerPos.y);

        this.updateMonsterPosition();
        this.startHorrorMusic();

        this.monsterInterval = setInterval(() => {
            this.moveMonster();
        }, 500);
    }

    moveMonster() {
        // Log to verify movement
        // console.log('Monster position:', this.monsterPos);

        const dx = this.playerPos.x - this.monsterPos.x;
        const dy = this.playerPos.y - this.monsterPos.y;

        // Possible directions sorted by closeness to player
        const directions = [
            {dx: dx > 0 ? 1 : -1, dy: 0},
            {dx: 0, dy: dy > 0 ? 1 : -1}
        ];

        // Try to move along the direction of greatest absolute difference first, then second
        // Or if blocked, try the other direction.

        let moved = false;

        for (let dir of directions) {
            if ((dir.dx !== 0 || dir.dy !== 0) && this.canMonsterMove(dir.dx, dir.dy)) {
                this.monsterPos.x += dir.dx;
                this.monsterPos.y += dir.dy;
                moved = true;
                break;
            }
        }

        // If cannot move towards player, try all directions randomly for some movement
        if (!moved) {
            const allDirs = [
                {dx:1, dy:0},
                {dx:-1, dy:0},
                {dx:0, dy:1},
                {dx:0, dy:-1}
            ];

            // Shuffle for randomness
            for (let i = allDirs.length -1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i+1));
                [allDirs[i], allDirs[j]] = [allDirs[j], allDirs[i]];
            }

            for (let dir of allDirs) {
                if (this.canMonsterMove(dir.dx, dir.dy)) {
                    this.monsterPos.x += dir.dx;
                    this.monsterPos.y += dir.dy;
                    moved = true;
                    break;
                }
            }
        }

        // If still no movement possible, monster stays in place.

        this.updateMonsterPosition();

        if (this.monsterPos.x === this.playerPos.x && this.monsterPos.y === this.playerPos.y) {
            alert('Game Over! The monster caught you!');
            clearInterval(this.monsterInterval);
            location.reload();
        }
    }

    canMonsterMove(dx, dy) {
        const newX = this.monsterPos.x + dx;
        const newY = this.monsterPos.y + dy;
        if (!this.isValidCell(newX, newY)) return false;
        const cell = this.mazeGrid[this.monsterPos.y][this.monsterPos.x];

        if (dx === 1 && cell.walls.right) return false;
        if (dx === -1 && cell.walls.left) return false;
        if (dy === 1 && cell.walls.bottom) return false;
        if (dy === -1 && cell.walls.top) return false;

        return true;
    }

    updateMonsterPosition() {
        document.querySelectorAll('.monster').forEach(el => el.classList.remove('monster'));
        const index = this.monsterPos.y * this.mazeSize + this.monsterPos.x;
        const mazeChildren = document.getElementById('maze').children;
        if (mazeChildren[index]) {
            mazeChildren[index].classList.add('monster');
        }
    }

    getUnvisitedNeighbors(pos) {
        const neighbors = [];
        const directions = [
            {x:0, y:-1, wall:'top'},
            {x:1, y:0, wall:'right'},
            {x:0, y:1, wall:'bottom'},
            {x:-1,y:0, wall:'left'}
        ];
        for (const dir of directions) {
            const newX = pos.x + dir.x;
            const newY = pos.y + dir.y;
            if (this.isValidCell(newX, newY) && !this.visited.has(`${newX},${newY}`)) {
                neighbors.push({x:newX, y:newY, dir:dir.wall});
            }
        }
        return neighbors;
    }

    removeWall(current, next) {
        const dx = next.x - current.x;
        const dy = next.y - current.y;

        if (dx === 1) {
            this.mazeGrid[current.y][current.x].walls.right = false;
            this.mazeGrid[next.y][next.x].walls.left = false;
        } else if (dx === -1) {
            this.mazeGrid[current.y][current.x].walls.left = false;
            this.mazeGrid[next.y][next.x].walls.right = false;
        }

        if (dy === 1) {
            this.mazeGrid[current.y][current.x].walls.bottom = false;
            this.mazeGrid[next.y][next.x].walls.top = false;
        } else if (dy === -1) {
            this.mazeGrid[current.y][current.x].walls.top = false;
            this.mazeGrid[next.y][next.x].walls.bottom = false;
        }
    }

    drawMaze() {
        const container = document.getElementById('maze');
        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.mazeSize}, 1fr)`;

        for (let y=0; y<this.mazeSize; y++) {
            for (let x=0; x<this.mazeSize; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.style.borderTop = this.mazeGrid[y][x].walls.top ? '4px solid #222' : 'none';
                cell.style.borderRight = this.mazeGrid[y][x].walls.right ? '4px solid #222' : 'none';
                cell.style.borderBottom = this.mazeGrid[y][x].walls.bottom ? '4px solid #222' : 'none';
                cell.style.borderLeft = this.mazeGrid[y][x].walls.left ? '4px solid #222' : 'none';
                cell.style.borderTop = this.mazeGrid[y][x].walls.top ? '4px solid #222' : 'none';
                cell.style.borderRight = this.mazeGrid[y][x].walls.right ? '4px solid #222' : 'none';
                cell.style.borderBottom = this.mazeGrid[y][x].walls.bottom ? '4px solid #222' : 'none';
                cell.style.borderLeft = this.mazeGrid[y][x].walls.left ? '4px solid #222' : 'none';
                if (x === this.exitPos.x && y === this.exitPos.y) {
                    cell.classList.add('exit');
                }

                const fog = document.createElement('div');
                fog.className = `fog ${!this.mazeGrid[y][x].fog ? 'revealed' : ''}`;
                cell.appendChild(fog);

                container.appendChild(cell);
            }
        }
    }

    movePlayer(dx, dy) {
        const newX = this.playerPos.x + dx;
        const newY = this.playerPos.y + dy;

        if (this.isValidMove(newX, newY)) {
            this.playerPos.x = newX;
            this.playerPos.y = newY;
            this.updatePlayerPosition();
            this.updateFog();

            if (this.playerPos.x === this.exitPos.x && this.playerPos.y === this.exitPos.y) {
                this.nextStage();
            }
        }
    }

    isValidMove(x, y) {
        if (!this.isValidCell(x, y)) return false;
        const currentCell = this.mazeGrid[this.playerPos.y][this.playerPos.x];
        if (x > this.playerPos.x && !currentCell.walls.right) return true;
        if (x < this.playerPos.x && !currentCell.walls.left) return true;
        if (y > this.playerPos.y && !currentCell.walls.bottom) return true;
        if (y < this.playerPos.y && !currentCell.walls.top) return true;
        return false;
    }

    updatePlayerPosition() {
        const cells = document.getElementsByClassName('player');

        while (cells.length > 0) cells[0].classList.remove('player');
        // Add a footprint at the previous position
        const prevIndex = this.playerPos.y * this.mazeSize + this.playerPos.x;
        const prevCell = document.getElementById('maze').children[prevIndex];
        const footprint = document.createElement('div');
        footprint.className = 'footprint';
        prevCell.appendChild(footprint);
        // Add the player to the new position
        const index = this.playerPos.y * this.mazeSize + this.playerPos.x;
        document.getElementById('maze').children[index].classList.add('player');
    }

    updateFog() {

    const revealDistance = this.torchRadius;

        for (let y = 0; y < this.mazeSize; y++) {
            for (let x = 0; x < this.mazeSize; x++) {
                const distance = Math.abs(x - this.playerPos.x) + Math.abs(y - this.playerPos.y);

                if (distance <= revealDistance) {
                    this.mazeGrid[y][x].fog = false;
                    const fogElement = document.getElementById('maze')
                        .children[y * this.mazeSize + x]
                        .querySelector('.fog');
                    fogElement.classList.add('revealed');
                }
            }
        }
    }

    // Check if the player is standing still

    checkStandingStill() {

        if (this.playerPos.x === this.lastPlayerPos.x && this.playerPos.y === this.lastPlayerPos.y) {
            this.standingStillTime++;
            if (this.standingStillTime >= 3) { // After 3 seconds
                this.torchRadius = Math.min(this.torchRadius + 1, 5); // Expand radius up to 5
                this.updateFog();
            }
        } else {
            this.standingStillTime = 0;
            this.torchRadius = 2; // Reset radius when moving
        }
        this.lastPlayerPos = {...this.playerPos};
    }

    nextStage() {
        this.currentStage++;
        this.generateMaze();
        this.updateStageDisplay();
        this.spawnMonster();
    }

    updateStageDisplay() {
        document.getElementById('stageDisplay').textContent = `Stage: ${this.currentStage}`;
    }

    setupControls() {
        document.addEventListener('keydown', e => {
            switch(e.key) {
                case 'ArrowUp': this.movePlayer(0,-1); break;
                case 'ArrowDown': this.movePlayer(0,1); break;
                case 'ArrowLeft': this.movePlayer(-1,0); break;
                case 'ArrowRight': this.movePlayer(1,0); break;
            }
        });
    }

    isValidCell(x,y) {
        return x >= 0 && x < this.mazeSize && y >= 0 && y < this.mazeSize;
    }

    startBackgroundMusic() {
        const bgMusic = document.getElementById('backgroundMusic');
        bgMusic.volume = 0.3;
        const playPromise = bgMusic.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {});
        }
    }

    startHorrorMusic() {
        const bgMusic = document.getElementById('backgroundMusic');
        const horrorMusic = document.getElementById('horrorMusic');
        bgMusic.pause();
        horrorMusic.volume = 0.4;
        const playPromise = horrorMusic.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {});
        }
    }

    stopHorrorMusic() {
        const horrorMusic = document.getElementById('horrorMusic');
        horrorMusic.pause();
    }
}

new MazeGame();
