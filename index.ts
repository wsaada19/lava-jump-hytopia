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
  Vector3,
  type Vector3Like,
} from 'hytopia';

import worldMap from './assets/map.json';
import GlassBridge from './scripts/glassBridge';

export const PLAYER_LAVA_FALL_EVENT = 'PLAYER_LAVA_FALL_EVENT';
export interface PlayerLavaFallEventPayload { player: PlayerEntity }

startServer(world => {
  // world.simulation.enableDebugRendering(true);

  world.loadMap(worldMap);

  const faultyBlockId = 101
  const faultyBlock = world.blockTypeRegistry.registerGenericBlockType({
    id: faultyBlockId,
    textureUri: 'textures/glass.png',
    name: 'Faulty Platform'
  })



  faultyBlock.onEntityCollision = (type: BlockType, entity: Entity, started: boolean, colliderHandleA: number, colliderHandleB: number) => {
    if (started) {
      const contactManifolds = world.simulation.getContactManifolds(colliderHandleA, colliderHandleB);

      let contactPoint: Vector3Like | undefined;

      contactManifolds.forEach(contactManifold => {
        if (contactManifold.contactPoints.length > 0) {
          contactPoint = contactManifold.contactPoints[0]
        }
      });

      console.log(contactPoint)
      console.log(entity.position)

      // If we have a contact point, use it to determine the block position
      // Otherwise fallback to entity position
      let position = entity.position;
      if (contactPoint) {
        // The contact point is in world space, round to nearest block coordinates
        position = {
          x: Math.round(contactPoint.x),
          y: Math.round(contactPoint.y),
          z: Math.round(contactPoint.z)
        };
      }
      // calculate the correct block position by using the player entity position & the contact point.
      // const position = contactPoint || entity.position
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (let dy = -1; dy <= 1; dy++) {
            // log position to remove
            if (world.chunkLattice.getBlockId({
              x: position.x + dx,
              y: position.y + dy,
              z: position.z + dz
            }) === faultyBlockId) {
              world.chunkLattice.setBlock({
                x: position.x + dx,
                y: position.y + dy,
                z: position.z + dz
              }, 0)
            }
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
  }

  world.simulation.setGravity({ x: 0, y: -28, z: 0 });

  const spawnPosition = { x: 0, y: 17, z: 0 }

  const glassBridge = new GlassBridge(world, faultyBlockId, spawnPosition)
  world.setAmbientLightColor({ r: 198, g: 198, b: 198 }); // very red ambient lighting

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
