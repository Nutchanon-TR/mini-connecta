'use client';

import { useFrame, useThree } from '@react-three/fiber';
import type { Point } from '@mini-connecta/shared/navigation';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Group } from 'three';
import type { Preset } from '@/features/avatar/presets';
import { BlobShadow } from './BlobShadow';
import { CharacterRig } from './character-rig';
import type { ActiveGame } from './game-connection';

const looks = {
  strawberry: { hair: '#f8ce8f', outfit: '#ff6fa8', accessory: 'ribbon' },
  matcha: { hair: '#b67c53', outfit: '#68a982', accessory: 'headphones' },
} as const satisfies Record<Preset, ConstructorParameters<typeof CharacterRig>[0]>;

export function RoomCharacter({
  game,
  id,
  cameraFocus,
  current,
}: {
  game: ActiveGame;
  id: string;
  cameraFocus?: RefObject<Group | null>;
  current: () => Point;
}) {
  const avatarRoot = useRef<Group>(null);
  const root = cameraFocus ?? avatarRoot;
  const narrow = useThree(({ size }) => size.width < 670);
  const [start] = useState(() => game.readSnapshot().players[id]);
  const preset = start?.preset ?? 'strawberry';
  const local = game.sessionId === id;
  const rig = useMemo(
    () => new CharacterRig(looks[preset], narrow ? 'low' : 'full'),
    [narrow, preset],
  );

  useEffect(() => () => rig.dispose(), [rig]);

  useFrame(({ clock }, delta) => {
    const body = root.current;
    const player = game.readSnapshot().players[id];
    if (!body || !player) return;
    const point = local ? current() : player;
    const dx = point.x - body.position.x;
    const dz = point.z - body.position.z;
    const alpha = 1 - Math.exp(-18 * delta);
    body.position.x += dx * alpha;
    body.position.z += dz * alpha;
    const moving = Math.hypot(dx, dz) > 0.028;
    const heading = local && moving ? Math.atan2(dx, dz) : player.heading;
    rig.update(delta, clock.elapsedTime, heading, {
      walking: moving,
      seated: false,
      talking: false,
      happy: false,
    });
  }, -1);

  return (
    <group ref={root} position={[start?.x ?? 0, 0, start?.z ?? 0]}>
      <BlobShadow radius={0.46} />
      <primitive object={rig.group} />
      {local && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]}>
          <ringGeometry args={[0.4, 0.47, 36]} />
          <meshBasicMaterial color="#ffaf7a" transparent opacity={0.93} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
