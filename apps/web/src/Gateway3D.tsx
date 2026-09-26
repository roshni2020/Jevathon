import { useEffect, useRef } from "react";
import * as THREE from "three";

type Fate = "allow" | "ask" | "block";
const COLOR: Record<Fate, number> = { allow: 0x10b981, ask: 0xf59e0b, block: 0xef4444 };
/** Roughly the mix Guardian actually produces across the three scenarios. */
const MIX: Fate[] = ["allow", "allow", "allow", "ask", "block", "allow", "ask", "allow", "block", "allow"];

interface Particle {
  mesh: THREE.Mesh;
  fate: Fate;
  speed: number;
  /** false until it reaches the gate and its fate is applied. */
  judged: boolean;
  trail: THREE.Line;
}

/**
 * Actions flow from the agent on the left toward the gate. Guardian judges each one:
 * allowed ones pass through and continue, blocked ones stop dead and fall away,
 * the ones needing a parent hover at the gate. It is the architecture diagram, moving.
 */
export default function Gateway3D({ height = 380 }: { height?: number }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, el.clientWidth / height, 0.1, 100);
    camera.position.set(0.6, 2.4, 11);
    camera.lookAt(0, 0.1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, height);
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(4, 7, 8);
    scene.add(key);

    // --- the gate: a translucent pane the actions must cross ---
    const gate = new THREE.Group();
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 5.2),
      new THREE.MeshPhysicalMaterial({
        color: 0x6366f1,
        transparent: true,
        opacity: 0.1,
        roughness: 0.1,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
    gate.add(pane);
    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(2.7, 0.045, 12, 4),
      new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.35 }),
    );
    frame.rotation.z = Math.PI / 4;
    gate.add(frame);
    // A faint grid across the pane, so "a surface everything passes through" reads clearly.
    for (let i = -2; i <= 2; i++) {
      for (const vertical of [true, false]) {
        const g = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(vertical ? i : -2.4, vertical ? -2.4 : i, 0),
          new THREE.Vector3(vertical ? i : 2.4, vertical ? 2.4 : i, 0),
        ]);
        gate.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.28 })));
      }
    }
    scene.add(gate);

    // --- particles: proposed actions ---
    const geo = new THREE.IcosahedronGeometry(0.16, 1);
    const particles: Particle[] = [];
    const START = -9;

    function spawn(i: number): Particle {
      const fate = MIX[i % MIX.length];
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.1 }),
      );
      mesh.position.set(START - Math.random() * 6, (Math.random() - 0.5) * 3.2, (Math.random() - 0.5) * 2.4);
      scene.add(mesh);

      const trailGeo = new THREE.BufferGeometry().setFromPoints([mesh.position.clone(), mesh.position.clone()]);
      const trail = new THREE.Line(
        trailGeo,
        new THREE.LineBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.5 }),
      );
      scene.add(trail);

      return { mesh, fate, speed: 0.032 + Math.random() * 0.022, judged: false, trail };
    }
    for (let i = 0; i < 26; i++) particles.push(spawn(i));

    function reset(p: Particle, i: number) {
      p.fate = MIX[(i + Math.floor(Math.random() * MIX.length)) % MIX.length];
      p.judged = false;
      p.speed = 0.032 + Math.random() * 0.022;
      p.mesh.position.set(START - Math.random() * 4, (Math.random() - 0.5) * 3.2, (Math.random() - 0.5) * 2.4);
      p.mesh.scale.setScalar(1);
      (p.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x94a3b8);
      (p.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
    }

    let raf = 0;
    const clock = new THREE.Clock();

    function frameLoop() {
      const t = clock.getElapsedTime();
      gate.rotation.y = Math.sin(t * 0.35) * 0.22;
      pane.material.opacity = 0.08 + Math.sin(t * 1.6) * 0.03;

      particles.forEach((p, i) => {
        const mat = p.mesh.material as THREE.MeshStandardMaterial;

        if (!p.judged && p.mesh.position.x >= 0) {
          // The verdict lands exactly at the gate.
          p.judged = true;
          mat.color.setHex(COLOR[p.fate]);
          mat.emissive.setHex(COLOR[p.fate]);
          mat.emissiveIntensity = 0.55;
          if (p.fate === "block") p.speed = -0.055;
          if (p.fate === "ask") p.speed = 0.002;
        }

        p.mesh.position.x += p.speed;
        p.mesh.position.y += Math.sin(t * 1.2 + i) * 0.0022;
        p.mesh.rotation.x += 0.012;
        p.mesh.rotation.y += 0.016;

        if (p.judged && p.fate === "block") {
          p.mesh.position.y -= 0.024; // stopped, and falls away
          p.mesh.scale.multiplyScalar(0.985);
        }
        if (p.judged && p.fate === "ask") {
          p.mesh.scale.setScalar(1 + Math.sin(t * 5 + i) * 0.12); // waiting on a parent
        }

        const pts = (p.trail.geometry as THREE.BufferGeometry).attributes.position.array as Float32Array;
        pts[0] = p.mesh.position.x - Math.sign(p.speed || 1) * 0.9;
        pts[1] = p.mesh.position.y;
        pts[2] = p.mesh.position.z;
        pts[3] = p.mesh.position.x;
        pts[4] = p.mesh.position.y;
        pts[5] = p.mesh.position.z;
        (p.trail.geometry as THREE.BufferGeometry).attributes.position.needsUpdate = true;
        (p.trail.material as THREE.LineBasicMaterial).color.setHex(p.judged ? COLOR[p.fate] : 0xcbd5e1);

        if (p.mesh.position.x > 9 || p.mesh.position.x < START - 8 || p.mesh.position.y < -4) reset(p, i);
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frameLoop);
    }
    frameLoop();

    const ro = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, height);
      camera.aspect = el.clientWidth / height;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      geo.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      el.removeChild(renderer.domElement);
    };
  }, [height]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-indigo-50/70 via-white to-white">
      <div ref={host} style={{ height }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-6 pb-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <span>agent proposes</span>
        <span className="text-indigo-500">guardian gate</span>
        <span>action executes</span>
      </div>
    </div>
  );
}
