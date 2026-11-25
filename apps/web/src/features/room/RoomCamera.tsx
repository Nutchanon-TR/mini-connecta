'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { OrthographicCamera, Vector3, type Group } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const cameraOffset = new Vector3(18, 17, 21);
const focusHeight = 0.8;

export type ChangeZoom = (factor: number | 'reset') => void;

export function RoomCamera({
  focus,
  changeZoom,
}: {
  focus: RefObject<Group | null>;
  changeZoom: RefObject<ChangeZoom | null>;
}) {
  const { camera, gl, size } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const zoom = Math.min(size.width / 9, size.height / 10, 78);
  const zoomRef = useRef(zoom);

  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    const orbit = new OrbitControls(camera, gl.domElement);
    const start = focus.current?.position;
    orbit.target.set(start?.x ?? 0, focusHeight, start?.z ?? 0);
    camera.position.copy(orbit.target).add(cameraOffset);
    orbit.enableDamping = true;
    orbit.enablePan = false;
    // Keep the view on the open sides of the library, clear of its two walls.
    orbit.minAzimuthAngle = 0;
    orbit.maxAzimuthAngle = Math.PI / 2;
    orbit.minPolarAngle = 0.38;
    orbit.maxPolarAngle = 1.13;
    orbit.minZoom = 22;
    orbit.maxZoom = 135;
    orbit.update();
    controls.current = orbit;
    changeZoom.current = (factor) => {
      camera.zoom =
        factor === 'reset'
          ? zoomRef.current
          : Math.max(orbit.minZoom, Math.min(orbit.maxZoom, camera.zoom * factor));
      camera.updateProjectionMatrix();
    };

    return () => {
      orbit.dispose();
      controls.current = null;
      changeZoom.current = null;
    };
  }, [camera, changeZoom, focus, gl]);

  useLayoutEffect(() => {
    zoomRef.current = zoom;
    if (controls.current) controls.current.maxZoom = Math.min(135, size.width / 4.85);
    changeZoom.current?.('reset');
  }, [changeZoom, size.width, zoom]);

  useFrame((_state, dt) => {
    const orbit = controls.current;
    const player = focus.current?.position;
    if (!orbit || !player) return;
    // Move the camera with its target to keep the orbit angle while the avatar walks.
    camera.position.x += player.x - orbit.target.x;
    camera.position.z += player.z - orbit.target.z;
    orbit.target.set(player.x, focusHeight, player.z);
    orbit.update(dt);
  });
  return null;
}
