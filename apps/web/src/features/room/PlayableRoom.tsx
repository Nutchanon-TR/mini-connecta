'use client';

import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { BOUNDS } from '@mini-connecta/shared/layout';
import { moveInterval, walk, walkSpeed } from '@mini-connecta/shared/movement';
import { findPath, type Point } from '@mini-connecta/shared/navigation';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Vector3, type Group } from 'three';
import { Library } from './Library';
import { RoomCamera, type ChangeZoom } from './RoomCamera';
import { RoomCharacter } from './RoomCharacter';
import { lightAt } from './dayCycle';
import type { ActiveGame } from './game-connection';

const lighting = lightAt(17.5);
const axes = new Map([
  ['KeyW', [0, -1]],
  ['ArrowUp', [0, -1]],
  ['KeyS', [0, 1]],
  ['ArrowDown', [0, 1]],
  ['KeyA', [-1, 0]],
  ['ArrowLeft', [-1, 0]],
  ['KeyD', [1, 0]],
  ['ArrowRight', [1, 0]],
]);

function RoomContents({
  game,
  onReady,
  changeZoom,
}: {
  game: ActiveGame;
  onReady: () => void;
  changeZoom: React.RefObject<ChangeZoom | null>;
}) {
  const players = useCallback(() => Object.keys(game.readSnapshot().players).join(' '), [game]);
  const roster = useSyncExternalStore(game.subscribe, players, players);
  const local = game.readSnapshot().players[game.sessionId];
  const motion = useRef({
    point: { x: local.x, z: local.z },
    seq: local.lastMoveSeq,
    sent: 0,
    ack: local.lastMoveSeq,
    samples: new Map<number, Point>(),
  });
  const current = useCallback(() => motion.current.point, []);
  const cameraFocus = useRef<Group>(null);
  const view = useRef(new Vector3());
  const keys = useRef(new Set<string>());
  const path = useRef<Point[]>([]);

  useEffect(() => {
    const signal = game.inputSignal;
    const keyboard = new AbortController();
    const scope = AbortSignal.any([signal, keyboard.signal]);
    function clear() {
      keys.current.clear();
      path.current = [];
    }
    window.addEventListener('blur', clear, { signal: scope });
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey || !axes.has(event.code)) return;
        if (
          event.target instanceof HTMLElement &&
          event.target.matches('input, textarea, select, button, [contenteditable]')
        )
          return;
        event.preventDefault();
        keys.current.add(event.code);
        path.current = [];
      },
      { signal: scope },
    );
    window.addEventListener(
      'keyup',
      (event) => {
        keys.current.delete(event.code);
      },
      { signal: scope },
    );
    scope.addEventListener('abort', clear, { once: true });
    const frame = requestAnimationFrame(() => {
      if (!scope.aborted) onReady();
    });
    return () => {
      keyboard.abort();
      cancelAnimationFrame(frame);
    };
  }, [game, onReady]);

  // Update movement before positioning the avatars and then the camera.
  useFrame(({ camera }, delta) => {
    if (game.inputSignal.aborted) return;
    const player = game.readSnapshot().players[game.sessionId];
    if (!player) return;
    const state = motion.current;
    if (player.lastMoveSeq > state.ack) {
      const sampled = state.samples.get(player.lastMoveSeq);
      if (sampled) {
        state.point = walk(
          state.point,
          {
            x: state.point.x + player.x - sampled.x,
            z: state.point.z + player.z - sampled.z,
          },
          2,
        );
      }
      state.ack = player.lastMoveSeq;
      for (const seq of state.samples.keys()) if (seq <= state.ack) state.samples.delete(seq);
    }

    let dx = 0;
    let dz = 0;
    for (const key of keys.current) {
      const axis = axes.get(key);
      if (axis) {
        dx += axis[0];
        dz += axis[1];
      }
    }
    const next = path.current[0];
    if (next && Math.hypot(next.x - state.point.x, next.z - state.point.z) < 0.12)
      path.current.shift();
    let goal = path.current[0];
    if (dx || dz) {
      const forward = camera.getWorldDirection(view.current);
      forward.y = 0;
      forward.normalize();
      goal = {
        x: state.point.x - forward.z * dx - forward.x * dz,
        z: state.point.z + forward.x * dx - forward.z * dz,
      };
    }
    const now = performance.now();
    if (!goal && Math.hypot(state.point.x - player.x, state.point.z - player.z) < 0.02) return;
    if (goal) state.point = walk(state.point, goal, Math.min(delta, 0.05) * walkSpeed);
    if (now - state.sent >= moveInterval) {
      state.sent = now;
      state.seq++;
      state.samples.set(state.seq, state.point);
      if (state.samples.size > 32) state.samples.delete(state.seq - 32);
      game.sendMove({ seq: state.seq, ...state.point });
    }
  }, -2);

  function click(event: ThreeEvent<MouseEvent>) {
    if (event.delta > 6 || game.inputSignal.aborted) return;
    event.stopPropagation();
    path.current = findPath(motion.current.point, { x: event.point.x, z: event.point.z });
  }

  return (
    <>
      <Library light={lighting} shadows={false} />
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={click}>
        <planeGeometry args={[BOUNDS.maxX * 2, BOUNDS.maxZ * 2]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {roster
        .split(' ')
        .filter(Boolean)
        .map((id) => (
          <RoomCharacter
            key={id}
            game={game}
            id={id}
            current={current}
            cameraFocus={id === game.sessionId ? cameraFocus : undefined}
          />
        ))}
      <RoomCamera focus={cameraFocus} changeZoom={changeZoom} />
    </>
  );
}

export function PlayableRoom({ game, onReady }: { game: ActiveGame; onReady: () => void }) {
  const changeZoom = useRef<ChangeZoom | null>(null);
  return (
    <div
      className="room-canvas"
      aria-label="Playable Library. Use WASD, arrows, or tap the floor to walk. Drag to turn the camera."
    >
      <Canvas
        orthographic
        dpr={[1, 1.5]}
        camera={{ near: 0.1, far: 120 }}
        fallback={
          <p className="room-reconnect" role="alert">
            3D needs WebGL. Enable graphics acceleration and reload.
          </p>
        }
      >
        <color attach="background" args={['#271e30']} />
        <RoomContents game={game} onReady={onReady} changeZoom={changeZoom} />
      </Canvas>
      <div className="room-zoom" role="group" aria-label="Camera zoom">
        <button type="button" aria-label="Zoom out" onClick={() => changeZoom.current?.(1 / 1.2)}>
          −
        </button>
        <button type="button" aria-label="Reset zoom" onClick={() => changeZoom.current?.('reset')}>
          Reset
        </button>
        <button type="button" aria-label="Zoom in" onClick={() => changeZoom.current?.(1.2)}>
          +
        </button>
      </div>
    </div>
  );
}
