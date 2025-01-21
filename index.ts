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
  World,
  Player,
} from 'hytopia';

import worldMap from './assets/map.json';
import GlassBridge from './scripts/glassBridge';

export const PLAYER_VOID_FALL_EVENT = 'PLAYER_VOID_FALL_EVENT';
export interface PlayerVoidFallEventPayload { player: PlayerEntity }

const SPAWN = { x: 0, y: 17, z: 0 }
const VICTORY_BLOCK_ID = 102
const FAULTY_BLOCK_ID = 101


startServer(world => {
  // world.simulation.enableDebugRendering(true);

  world.loadMap(worldMap);
  const glassBridge = new GlassBridge(world, FAULTY_BLOCK_ID, SPAWN)
  loadCustomBlocks(world, glassBridge)

  world.simulation.setGravity({ x: 0, y: -28, z: 0 });
  world.setAmbientLightColor({ r: 198, g: 198, b: 198 });
  new Audio({
    uri: 'audio/music/overworld.mp3',
    loop: true,
    volume: 0.1,
  }).play(world);

  world.onPlayerJoin = player => onPlayerJoin(world, player, glassBridge)
  world.onPlayerLeave = player => onPlayerLeave(world, player, glassBridge)

  // testing custom events, would be useful if we wanted multiple subscriptions
  // to the same event across our codebase
  world.eventRouter.on<EntityEventPayload.UpdatePosition>(
    EntityEventType.UPDATE_POSITION,
    (payload: EntityEventPayload.UpdatePosition) => {
      if (payload.position.y < 0 && payload.entity instanceof PlayerEntity) {
        world.eventRouter.emit<PlayerVoidFallEventPayload>(
          PLAYER_VOID_FALL_EVENT,
          { player: payload.entity }
        )
      }
    }
  )
  world.eventRouter.on<PlayerVoidFallEventPayload>(
    PLAYER_VOID_FALL_EVENT,
    (payload: PlayerVoidFallEventPayload) => {
      glassBridge.onPlayerFall(payload.player)
    }
  )
});

function onPlayerJoin(world: World, player: Player, glassBridge: GlassBridge) {
  const playerEntity = new PlayerEntity({
    player,
    name: 'Player',
    modelUri: 'models/player.gltf',
    modelLoopedAnimations: ['idle'],
    modelScale: 0.5,
  });

  playerEntity.spawn(world, SPAWN);
  glassBridge.play(playerEntity.player);

  // Send a nice welcome message that only the player who joined will see ;)
  world.chatManager.sendPlayerMessage(player, 'Welcome to the game!', '00FF00');
  world.chatManager.sendPlayerMessage(player, 'Use WASD to move around.');
  world.chatManager.sendPlayerMessage(player, 'Press space to jump.');
  world.chatManager.sendPlayerMessage(player, 'Press \\ to enter or exit debug view.');
  player.ui.load('ui/index.html')
  player.input['sh'] = false;

  player.ui.onData = (playerUI: PlayerUI, data: { button?: string }) => {
    if (data.button && data.button === 'spawn') {
      playerEntity.setPosition(SPAWN)
    }
    if (data.button && data.button === 'reset') {
      glassBridge.reset(playerEntity)
    }
  };
}

function onPlayerLeave(world: World, player: Player, glassBridge: GlassBridge) {
  world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => entity.despawn());
  glassBridge.stop()
}

function loadCustomBlocks(world: World, glassBridge: GlassBridge) {
  const faultyBlock = world.blockTypeRegistry.registerGenericBlockType({
    id: FAULTY_BLOCK_ID,
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
            }) === FAULTY_BLOCK_ID) {
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

  const victoryBlock = world.blockTypeRegistry.registerGenericBlockType({
    id: VICTORY_BLOCK_ID,
    textureUri: 'textures/dragons_stone.png',
    name: 'Victory Block'
  })

  for (let x = 35; x <= 39; x++) {
    for (let z = -2; z <= 2; z++) {
      world.chunkLattice.setBlock({ x, y: 10, z }, VICTORY_BLOCK_ID)
    }
  }

  // Player wins when they collide with the victory block - TODO: make sure they land on the block
  victoryBlock.onEntityCollision = (type: BlockType, entity: Entity, started: boolean) => {
    if (started) {
      if(entity instanceof PlayerEntity && glassBridge.isActive) {
        entity.player.ui.sendData({ type: 'victory' })
        entity.startModelLoopedAnimations(['sleep'])
        glassBridge.stop()
      }
    }
  }
}
