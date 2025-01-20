import { Player, PlayerEntity, World, type Vector3Like } from "hytopia"

const PLATFORM_WIDTH = 3;
const GRID_ROWS = 2;
const GRID_COLS = 10;
const START_HEIGHT = 10;

class GlassBridge {
    private playDuration: number;
    private playerDeaths: number;
    private faultyPlatforms: { row: number, col: number }[] = [];
    private faultyBlockId: number;
    private world: World;
    private spawnPosition: Vector3Like;
    
    constructor(world: World, faultyBlockId: number, spawnPosition: Vector3Like) {
        this.world = world
        this.faultyBlockId = faultyBlockId
        this.playDuration = 0
        this.playerDeaths = 0
        this.spawnPosition = spawnPosition
        this.loadFaultyPlatforms()
        this.loadPlatforms()
    }

    play = (player: Player) => {
        setInterval(() => {
            this.playDuration += 1
            // send data to ui
            player.ui.sendData({ type: 'time-played', duration: this.playDuration })
        }, 1000)
    }

    onPlayerFall = (player: PlayerEntity) => {
        this.playerDeaths += 1
        this.loadPlatforms()
        player.player.ui.sendData({ type: 'player-deaths', deaths: this.playerDeaths })
        player.setPosition(this.spawnPosition)
    }

    loadFaultyPlatforms = () => {
         // Generate one faulty platform per row
         for (let col = 0; col < GRID_COLS; col++) {
            const faultyRow = Math.floor(Math.random() * GRID_ROWS);
            this.faultyPlatforms.push({ row: faultyRow, col });
        }
    }

    private createPlatform(x: number, y: number, z: number, blockId: number) {
        for (let dx = 0; dx < 2; dx++) {
            for (let dz = 0; dz < 2; dz++) {
                this.world.chunkLattice.setBlock({ 
                    x: x + dx, 
                    y, 
                    z: z + dz 
                }, blockId);
            }
        }
    }

    loadPlatforms = () => {
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const isFaulty = this.faultyPlatforms.some(fp => fp.row === row && fp.col === col);
    
                // Calculate position
                const x = col * PLATFORM_WIDTH + 4;
                const y = START_HEIGHT;
                const z = row * PLATFORM_WIDTH - 2;
    
                // Create 2x2 platform with appropriate block type
                this.createPlatform(x, y, z, isFaulty ? this.faultyBlockId : 6);
            }
        }
    }
    
}

export default GlassBridge;