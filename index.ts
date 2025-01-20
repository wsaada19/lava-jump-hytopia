import {
  startServer,
  Audio,
  GameServer,
  PlayerEntity,
  Entity,
  PlayerUI,
  type EntityEventPayload,
  EntityEventType,
  BlockType,
} from 'hytopia';

import worldMap from './assets/map.json';
import GlassBridge from './scripts/glassBridge';

export const PLAYER_LAVA_FALL_EVENT = 'PLAYER_LAVA_FALL_EVENT';
export interface PlayerLavaFallEventPayload { player: PlayerEntity }

/**
 * startServer is always the entry point for our game.
 * It accepts a single function where we should do any
 * setup necessary for our game. The init function is
 * passed a World instance which is the default
 * world created by the game server on startup.
 * 
 * Documentation: https://github.com/hytopiagg/sdk/blob/main/docs/server.startserver.md
 */

startServer(world => {
  // world.simulation.enableDebugRendering(true);

  world.loadMap(worldMap);

  const faultyBlockId = 101
  const faultyBlock = world.blockTypeRegistry.registerGenericBlockType({
    id: faultyBlockId,
    textureUri: 'textures/glass.png',
    name: 'Faulty Platform'
  })

  faultyBlock.onEntityCollision = (type: BlockType, entity: Entity) => {
    const position = entity.position
    position.y -= 1
    // Remove blocks in a 3x3 grid centered on the collision position
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        // log position to remove
        if (world.chunkLattice.getBlockId({
          x: position.x + dx,
          y: position.y,
          z: position.z + dz
        }) === faultyBlockId) {
          world.chunkLattice.setBlock({
            x: position.x + dx,
            y: position.y,
            z: position.z + dz
          }, 0)
        }
      }
    }

    const onBreakAudio = new Audio({
      uri: 'audio/sfx/glass.mp3',
      volume: 0.3,
      position: position,
    })
    onBreakAudio.play(world)

  }

  world.simulation.setGravity({ x: 0, y: -20, z: 0 });

  const spawnPosition = { x: 0, y: 15, z: 0 }

  const glassBridge = new GlassBridge(world, faultyBlockId, spawnPosition)
  world.setAmbientLightColor({ r: 198, g: 198, b: 198 }); // very red ambient lighting

  /**
   * Handle player joining the game. The onPlayerJoin
   * function is called when a new player connects to
   * the game. From here, we create a basic player
   * entity instance which automatically handles mapping
   * their inputs to control their in-game entity and
   * internally uses our player entity controller.
   */
  world.onPlayerJoin = player => {
    const playerEntity = new PlayerEntity({
      player,
      name: 'Player',
      modelUri: 'models/player.gltf',
      modelLoopedAnimations: ['idle'],
      modelScale: 0.5,
    });

    playerEntity.spawn(world, spawnPosition);
    glassBridge.play(playerEntity.player);

    // Send a nice welcome message that only the player who joined will see ;)
    world.chatManager.sendPlayerMessage(player, 'Welcome to the game!', '00FF00');
    world.chatManager.sendPlayerMessage(player, 'Use WASD to move around.');
    world.chatManager.sendPlayerMessage(player, 'Press space to jump.');
    world.chatManager.sendPlayerMessage(player, 'Hold shift to sprint.');
    world.chatManager.sendPlayerMessage(player, 'Press \\ to enter or exit debug view.');
    player.ui.load('ui/index.html')

    player.ui.onData = (playerUI: PlayerUI, data: { button?: string }) => {
      if (data.button && data.button === 'spawn') {
        playerEntity.setPosition(spawnPosition)
      }
    };

  };

  world.onPlayerLeave = player => {
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => entity.despawn());
  };

  world.eventRouter.on<EntityEventPayload.UpdatePosition>(
    EntityEventType.UPDATE_POSITION,
    (payload: EntityEventPayload.UpdatePosition) => {
      if (payload.position.y < 0 && payload.entity instanceof PlayerEntity) {
        world.eventRouter.emit<PlayerLavaFallEventPayload>(
          PLAYER_LAVA_FALL_EVENT,
          { player: payload.entity }
        )
      }
    }
  )
  world.eventRouter.on<PlayerLavaFallEventPayload>(
    PLAYER_LAVA_FALL_EVENT,
    (payload: PlayerLavaFallEventPayload) => {
      glassBridge.onPlayerFall(payload.player)
    }
  )
  new Audio({
    uri: 'audio/music/overworld.mp3',
    loop: true,
    volume: 0.1,
  }).play(world);

});
