import * as THREE from 'three';
import { BoxCollider, PhysicsSystem } from './PhysicsSystem';
import { InteractableObject } from './types';
import {
  createMetalPanelTexture,
  createPanelNormalMap,
  createSkyscraperFacadeTexture,
  createTerrainGridTexture
} from './Textures';

export class WorldBuilder {
  private scene: THREE.Scene;
  private physics: PhysicsSystem;
  private maxAnisotropy: number;

  public interactables: InteractableObject[] = [];
  public securityGateMesh!: THREE.Mesh;
  public securityGateCollider!: BoxCollider;
  public gateUnlocked = false;

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private ashParticles!: THREE.Points;
  private animatedMeshes: THREE.Object3D[] = [];
  private timeOfDay = 0.25;

  constructor(scene: THREE.Scene, physics: PhysicsSystem, maxAnisotropy: number) {
    this.scene = scene;
    this.physics = physics;
    this.maxAnisotropy = maxAnisotropy;
  }

  public buildWorld(): void {
    this.scene.background = new THREE.Color(0x060b16);
    this.scene.fog = new THREE.FogExp2(0x070d19, 0.0042);

    this.setupLighting();
    this.buildEclipseSkyDome();
    this.buildContinuousSculptedTerrain();
    this.buildMeridianCity();
    this.buildAshenWastelands();
    this.buildNexusComplex();
    this.buildAtmosphericAshParticles();
  }

  private setupLighting(): void {
    this.hemiLight = new THREE.HemisphereLight(0x4b749f, 0x161210, 0.9);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffb478, 2.3);
    this.sunLight.position.set(65, 95, 45);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.bias = -0.0005;
    const d = 135;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 280;
    this.scene.add(this.sunLight);
  }

  private buildEclipseSkyDome(): void {
    // Distant Eclipse Black Sun & Corona Ring high in the northern sky
    const eclipseGroup = new THREE.Group();
    eclipseGroup.position.set(0, 115, -295);

    const blackSun = new THREE.Mesh(
      new THREE.SphereGeometry(26, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x04070e })
    );
    eclipseGroup.add(blackSun);

    const coronaRing = new THREE.Mesh(
      new THREE.TorusGeometry(26.8, 1.35, 16, 64),
      new THREE.MeshBasicMaterial({ color: 0xff8c24 })
    );
    eclipseGroup.add(coronaRing);

    const outerHalo = new THREE.Mesh(
      new THREE.TorusGeometry(31.5, 0.4, 12, 64),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.45 })
    );
    eclipseGroup.add(outerHalo);

    this.scene.add(eclipseGroup);
  }

  private buildContinuousSculptedTerrain(): void {
    const size = 560;
    const segs = 140;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const posAttr = geo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    const cMeridian = new THREE.Color(0x1b2434);
    const cWasteland = new THREE.Color(0x3a2a22);
    const cNexus = new THREE.Color(0x0c1626);
    const tmpColor = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = this.physics.getTerrainHeight(vx, vz);
      posAttr.setY(i, vy);

      if (vz > 35) {
        tmpColor.copy(cMeridian);
      } else if (vz < -95) {
        tmpColor.copy(cNexus);
      } else {
        const t = (vz + 95) / 130;
        tmpColor.copy(cNexus).lerp(cWasteland, Math.min(1, t * 1.4));
        if (t > 0.65) {
          tmpColor.lerp(cMeridian, (t - 0.65) / 0.35);
        }
      }

      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const terrainTex = createTerrainGridTexture(this.maxAnisotropy);
    const normalMap = createPanelNormalMap();
    const terrainMat = new THREE.MeshStandardMaterial({
      map: terrainTex,
      normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.18
    });

    const terrainMesh = new THREE.Mesh(geo, terrainMat);
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);
  }

  /**
   * REGION A: MERIDIAN CITY (South, z > 30)
   * Cylindrical, Octagonal & Stepped Skyscrapers, Curved Cryo-Pod Chamber, Arched Highway Overpass
   */
  private buildMeridianCity(): void {
    const skyscraperTex = createSkyscraperFacadeTexture(this.maxAnisotropy);
    const metalTex = createMetalPanelTexture('#1a2333', '#2d3f5e', this.maxAnisotropy);
    const normalMap = createPanelNormalMap();

    const facadeMat = new THREE.MeshPhysicalMaterial({
      map: skyscraperTex,
      normalMap,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.3,
      metalness: 0.75,
      clearcoat: 0.5
    });

    const steelMat = new THREE.MeshPhysicalMaterial({
      map: metalTex,
      normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.42,
      metalness: 0.8,
      clearcoat: 0.25
    });

    const cyanNeon = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const amberNeon = new THREE.MeshBasicMaterial({ color: 0xff9d00 });

    // Awakening Cryo-Pod Rotunda at (-6.5, y, 172) framing the starting vista
    const podY = this.physics.getTerrainHeight(-6.5, 172);
    const podGroup = new THREE.Group();
    podGroup.position.set(-6.5, podY, 172);

    const rotundaPlatform = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.2, 0.35, 24), steelMat);
    rotundaPlatform.position.y = 0.18;
    rotundaPlatform.receiveShadow = true;
    podGroup.add(rotundaPlatform);

    const podBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 0.55, 20), steelMat);
    podBase.position.y = 0.45;
    podGroup.add(podBase);

    const podGlass = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.85, 1.6, 12, 20),
      new THREE.MeshPhysicalMaterial({
        color: 0x00f0ff,
        roughness: 0.1,
        metalness: 0.1,
        transparent: true,
        opacity: 0.65,
        clearcoat: 1.0
      })
    );
    podGlass.position.y = 1.85;
    podGroup.add(podGlass);

    const podHalo = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.07, 10, 28), cyanNeon);
    podHalo.rotation.x = Math.PI / 2;
    podHalo.position.y = 2.95;
    podGroup.add(podHalo);
    this.animatedMeshes.push(podHalo);

    this.scene.add(podGroup);
    this.physics.addCylinder(-6.5, 172, 1.8, 3.8);

    // Sculpted Non-Boxy Skyscrapers (Cylindrical, Octagonal, and Multi-Tiered Stepped Arcologies)
    const towers: {
      x: number;
      z: number;
      r: number;
      h: number;
      style: 'cylindrical' | 'octagonal' | 'stepped';
      neon: THREE.Material;
    }[] = [
      { x: -28, z: 162, r: 6.5, h: 34, style: 'octagonal', neon: cyanNeon },
      { x: 28, z: 160, r: 7.0, h: 40, style: 'cylindrical', neon: amberNeon },
      { x: -32, z: 128, r: 7.5, h: 46, style: 'stepped', neon: cyanNeon },
      { x: 32, z: 125, r: 6.8, h: 38, style: 'octagonal', neon: cyanNeon },
      { x: -26, z: 92, r: 6.5, h: 36, style: 'cylindrical', neon: amberNeon },
      { x: 26, z: 90, r: 7.2, h: 44, style: 'stepped', neon: cyanNeon },
      { x: -30, z: 58, r: 6.8, h: 32, style: 'octagonal', neon: amberNeon },
      { x: 30, z: 56, r: 6.8, h: 35, style: 'cylindrical', neon: cyanNeon }
    ];

    for (const t of towers) {
      const ty = this.physics.getTerrainHeight(t.x, t.z);
      const g = new THREE.Group();
      g.position.set(t.x, ty, t.z);

      if (t.style === 'cylindrical') {
        const podium = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 1.1, t.r * 1.18, 4.5, 24), steelMat);
        podium.position.y = 2.25;
        g.add(podium);

        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 0.92, t.r * 1.04, t.h - 6, 24), facadeMat);
        shaft.position.y = 4.5 + (t.h - 6) / 2;
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        g.add(shaft);

        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(t.r * 0.9, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
          steelMat
        );
        dome.position.y = t.h - 1.5;
        g.add(dome);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(t.r * 0.98, 0.14, 10, 32), t.neon);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = t.h * 0.78;
        g.add(ring);
      } else if (t.style === 'octagonal') {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 0.82, t.r * 1.08, t.h, 8), facadeMat);
        shaft.position.y = t.h / 2;
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        g.add(shaft);

        const crown = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 0.9, t.r * 0.9, 0.65, 8), t.neon);
        crown.position.y = t.h - 2.0;
        g.add(crown);

        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.38, 8.5, 8), steelMat);
        spire.position.y = t.h + 4.25;
        g.add(spire);
      } else {
        const h1 = t.h * 0.55;
        const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 1.05, t.r * 1.14, h1, 12), facadeMat);
        tier1.position.y = h1 / 2;
        tier1.castShadow = true;
        g.add(tier1);

        const h2 = t.h * 0.32;
        const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 0.76, t.r * 0.9, h2, 12), facadeMat);
        tier2.position.y = h1 + h2 / 2;
        tier2.castShadow = true;
        g.add(tier2);

        const h3 = t.h * 0.15;
        const tier3 = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 0.42, t.r * 0.66, h3, 12), steelMat);
        tier3.position.y = h1 + h2 + h3 / 2;
        g.add(tier3);

        const trim = new THREE.Mesh(new THREE.TorusGeometry(t.r * 0.94, 0.15, 8, 24), t.neon);
        trim.rotation.x = Math.PI / 2;
        trim.position.y = h1;
        g.add(trim);
      }

      this.scene.add(g);
      this.physics.addCylinder(t.x, t.z, t.r * 1.05, t.h);
    }

    // Elevated Highway Overpass Bridge across Meridian Avenue (z = 110)
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(0, 0, 110);
    for (const xCol of [-15, 15]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 7.5, 16), steelMat);
      col.position.set(xCol, 3.75, 0);
      col.castShadow = true;
      bridgeGroup.add(col);
      this.physics.addCylinder(xCol, 110, 1.4, 8.0);
    }
    const archDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 44, 12), steelMat);
    archDeck.rotation.z = Math.PI / 2;
    archDeck.scale.set(1.0, 1.0, 6.5);
    archDeck.position.set(0, 7.4, 0);
    bridgeGroup.add(archDeck);

    const railNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 44, 10), cyanNeon);
    railNeon.rotation.z = Math.PI / 2;
    railNeon.position.set(0, 8.0, 2.2);
    bridgeGroup.add(railNeon);
    this.scene.add(bridgeGroup);

    // Meridian Neural Beacon (Save & Heal Station at 12, 138)
    this.createBeacon(12, 138, 'beacon_meridian', 'Synchronize Meridian Neural Beacon (Heal & Save)');

    // Meridian Relay Terminal (Act I Main Objective at 0, 88)
    this.createTerminal(0, 88, 'term_meridian_relay', 'Decrypt Meridian Relay Terminal', 'relay_decrypted', cyanNeon);

    // Lore Datapads & Supply Caches in Meridian City
    this.createDatapad(-6, 166, 'pad_awakening', 'Recover Datapad: Sub-Facility Zero', 'lore_awakening');
    this.createDatapad(10, 105, 'pad_meridian', 'Recover Datapad: Evacuation Order', 'lore_meridian');
    this.createSupplyCache(-14, 144, 'cache_meridian_1');
    this.createSupplyCache(16, 70, 'cache_meridian_2');
  }

  /**
   * REGION B: THE ASHEN WASTELANDS (-95 <= z <= 30)
   * Hyperboloid Cooling Silos, Sloped Armored APC Wrecks with Round Wheels, Magma Craters & Colossus Arena
   */
  private buildAshenWastelands(): void {
    const metalTex = createMetalPanelTexture('#2b211d', '#4f382e', this.maxAnisotropy);
    const normalMap = createPanelNormalMap();

    const rustMat = new THREE.MeshStandardMaterial({
      map: metalTex,
      normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.78,
      metalness: 0.48
    });

    const steelMat = new THREE.MeshPhysicalMaterial({
      color: 0x263142,
      normalMap,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.38,
      metalness: 0.82,
      clearcoat: 0.3
    });

    const amberNeon = new THREE.MeshBasicMaterial({ color: 0xff9d00 });

    // Hyperboloid Industrial Cooling Towers (`LatheGeometry` + Geodesic Domes)
    const silos = [
      { x: -38, z: 16, r: 5.2, h: 16 },
      { x: -42, z: -28, r: 4.8, h: 14 },
      { x: 36, z: 18, r: 5.5, h: 18 },
      { x: 46, z: -58, r: 5.0, h: 15 }
    ];

    for (const s of silos) {
      const sy = this.physics.getTerrainHeight(s.x, s.z);
      const g = new THREE.Group();
      g.position.set(s.x, sy, s.z);

      const pts = [
        new THREE.Vector2(s.r * 1.06, 0),
        new THREE.Vector2(s.r * 0.86, s.h * 0.45),
        new THREE.Vector2(s.r * 0.76, s.h * 0.78),
        new THREE.Vector2(s.r * 0.92, s.h)
      ];
      const lathe = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), rustMat);
      lathe.castShadow = true;
      lathe.receiveShadow = true;
      g.add(lathe);

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(s.r * 0.9, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
        steelMat
      );
      dome.position.y = s.h - 0.2;
      g.add(dome);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(s.r * 0.85, 0.16, 10, 28), amberNeon);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = s.h * 0.65;
      g.add(ring);

      this.scene.add(g);
      this.physics.addCylinder(s.x, s.z, s.r * 1.02, s.h);
    }

    // Sloped Armored Military APC Wrecks (`ExtrudeGeometry` Hull + 6 Cylindrical Wheels + Domed Turret)
    const wrecks = [
      { x: -14, z: 6, rot: 0.4 },
      { x: 18, z: -14, rot: -0.55 },
      { x: -20, z: -46, rot: 0.25 }
    ];

    for (const w of wrecks) {
      this.createArmoredApcWreck(w.x, w.z, w.rot, steelMat, rustMat);
    }

    // Thermal Fissure Hazard Craters
    const hazards = [
      { x: -8, z: -16, r: 4.5 },
      { x: 14, z: -38, r: 4.5 },
      { x: -12, z: -64, r: 4.8 }
    ];

    for (const h of hazards) {
      const hy = this.physics.getTerrainHeight(h.x, h.z);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(h.r, 0.42, 10, 28), rustMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(h.x, hy + 0.12, h.z);
      this.scene.add(rim);

      const lava = new THREE.Mesh(
        new THREE.CircleGeometry(h.r - 0.15, 28),
        new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.68, side: THREE.DoubleSide })
      );
      lava.rotation.x = -Math.PI / 2;
      lava.position.set(h.x, hy + 0.14, h.z);
      this.scene.add(lava);

      this.physics.addHazard(h.x, h.z, h.r, 14);
    }

    // Iron Colossus Boss Arena Perimeter Ring & Pylons at (95, -25)
    const arenaY = this.physics.getTerrainHeight(95, -25);
    const arenaRing = new THREE.Mesh(new THREE.TorusGeometry(24, 0.28, 12, 64), amberNeon);
    arenaRing.rotation.x = Math.PI / 2;
    arenaRing.position.set(95, arenaY + 0.1, -25);
    this.scene.add(arenaRing);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = 95 + Math.cos(a) * 24;
      const pz = -25 + Math.sin(a) * 24;
      const py = this.physics.getTerrainHeight(px, pz);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.95, 6.5, 8), steelMat);
      pillar.position.set(px, py + 3.25, pz);
      pillar.castShadow = true;
      this.scene.add(pillar);
      this.physics.addCylinder(px, pz, 0.95, 6.5);
    }

    // Wasteland Datapads & Supply Caches
    this.createDatapad(56, -18, 'pad_colossus', 'Recover Datapad: Project Colossus Field Report', 'lore_colossus');
    this.createDatapad(-18, -8, 'pad_wasteland', 'Recover Datapad: Ashen Convoy Blackbox', 'lore_wasteland');
    this.createSupplyCache(22, -26, 'cache_waste_1');
    this.createSupplyCache(74, -12, 'cache_waste_2');
    this.createSupplyCache(-26, -68, 'cache_waste_3');
  }

  private createArmoredApcWreck(
    x: number,
    z: number,
    rotY: number,
    steelMat: THREE.Material,
    rustMat: THREE.Material
  ): void {
    const y = this.physics.getTerrainHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const hullShape = new THREE.Shape();
    hullShape.moveTo(-2.6, 0.45);
    hullShape.lineTo(2.4, 0.45);
    hullShape.lineTo(2.9, 1.15);
    hullShape.lineTo(1.8, 1.95);
    hullShape.lineTo(-2.1, 1.95);
    hullShape.lineTo(-2.7, 1.35);
    hullShape.closePath();

    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 2.4,
      bevelEnabled: true,
      bevelThickness: 0.14,
      bevelSize: 0.12,
      bevelSegments: 3
    });
    hullGeo.center();
    const hull = new THREE.Mesh(hullGeo, rustMat);
    hull.position.y = 1.25;
    hull.castShadow = true;
    hull.receiveShadow = true;
    group.add(hull);

    const turret = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      steelMat
    );
    turret.position.set(0.2, 2.0, 0);
    group.add(turret);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.8, 10), steelMat);
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(1.3, 2.25, 0);
    group.add(barrel);

    for (const wx of [-1.75, 0, 1.75]) {
      for (const wz of [-1.35, 1.35]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.42, 18), steelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx, 0.58, wz);
        wheel.castShadow = true;
        group.add(wheel);
      }
    }

    this.scene.add(group);
    this.physics.addCylinder(x, z, 2.5, 2.6);
  }

  /**
   * REGION C: NEXUS RESEARCH COMPLEX (z < -95)
   * Arched Security Gate, Hexagonal Obelisks, Overload Pylons & NEXUS Sanctum
   */
  private buildNexusComplex(): void {
    const bunkerTex = createMetalPanelTexture('#101826', '#00f0ff', this.maxAnisotropy);
    const normalMap = createPanelNormalMap();

    const nexusMat = new THREE.MeshPhysicalMaterial({
      map: bunkerTex,
      normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.25,
      metalness: 0.88,
      clearcoat: 0.65
    });

    const cyanNeon = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const redLaserMat = new THREE.MeshBasicMaterial({
      color: 0xff2a54,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });

    // Northern Security Gate Archway at z = -95
    const gateY = this.physics.getTerrainHeight(0, -95);
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.4, 15, 8), nexusMat);
      pylon.position.set(side * 11, gateY + 7.5, -95);
      pylon.castShadow = true;
      this.scene.add(pylon);
      this.physics.addCylinder(side * 11, -95, 2.4, 15);
    }

    const arch = new THREE.Mesh(new THREE.TorusGeometry(11, 1.3, 12, 28, Math.PI), nexusMat);
    arch.position.set(0, gateY + 13.5, -95);
    this.scene.add(arch);

    this.securityGateMesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), redLaserMat);
    this.securityGateMesh.position.set(0, gateY + 6, -95);
    this.scene.add(this.securityGateMesh);
    this.securityGateCollider = this.physics.addBox(0, -95, 19, 2.0, 14, 'nexus_security_gate');

    // Gate Override Terminal right in front of the gate (8, -89)
    this.createTerminal(8, -89, 'term_gate_override', 'Override NEXUS Security Gate', 'override_gate', cyanNeon);

    // Hexagonal NEXUS Obelisks lining the approach to the Core Chamber
    for (let z = -112; z >= -156; z -= 18) {
      for (const side of [-1, 1]) {
        const ox = side * 18;
        const oy = this.physics.getTerrainHeight(ox, z);
        const obeliskGroup = new THREE.Group();
        obeliskGroup.position.set(ox, oy, z);

        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.65, 12, 6), nexusMat);
        shaft.position.y = 6;
        shaft.castShadow = true;
        obeliskGroup.add(shaft);

        const apex = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 6), nexusMat);
        apex.position.y = 13.3;
        obeliskGroup.add(apex);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.09, 10, 24), cyanNeon);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 8.5;
        obeliskGroup.add(ring);
        this.animatedMeshes.push(ring);

        this.scene.add(obeliskGroup);
        this.physics.addCylinder(ox, z, 1.7, 14);
      }
    }

    // Final Boss Sanctum Ring & 3 Interactive Core Overload Pylons around (0, -180)
    const coreY = this.physics.getTerrainHeight(0, -180);
    const sanctumRing = new THREE.Mesh(new THREE.TorusGeometry(28, 0.35, 12, 64), cyanNeon);
    sanctumRing.rotation.x = Math.PI / 2;
    sanctumRing.position.set(0, coreY + 0.1, -180);
    this.scene.add(sanctumRing);

    const pylonOffsets = [
      { id: 'pylon_1', x: -18, z: -168 },
      { id: 'pylon_2', x: 18, z: -168 },
      { id: 'pylon_3', x: 0, z: -198 }
    ];
    for (const p of pylonOffsets) {
      this.createOverloadPylon(p.x, p.z, p.id, nexusMat, cyanNeon);
    }

    this.createDatapad(0, -118, 'pad_nexus_truth', 'Recover Datapad: Directive Omega', 'lore_nexus_truth');
    this.createSupplyCache(-12, -148, 'cache_nexus_1');
    this.createSupplyCache(12, -148, 'cache_nexus_2');
  }

  public unlockSecurityGate(): void {
    this.gateUnlocked = true;
    this.securityGateMesh.visible = false;
    this.securityGateCollider.active = false;
  }

  private createBeacon(x: number, z: number, id: string, label: string): void {
    const y = this.physics.getTerrainHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.5, 0.4, 18),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 })
    );
    base.position.y = 0.2;
    group.add(base);

    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.55, 2.6, 16),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25, metalness: 0.9 })
    );
    spire.position.y = 1.5;
    group.add(spire);

    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 1),
      new THREE.MeshBasicMaterial({ color: 0x00ff9d, wireframe: true })
    );
    orb.position.y = 3.2;
    group.add(orb);
    this.animatedMeshes.push(orb);

    this.scene.add(group);
    this.physics.addCylinder(x, z, 1.3, 3.5);

    this.interactables.push({
      id,
      type: 'beacon',
      label,
      position: new THREE.Vector3(x, y, z),
      mesh: group,
      used: false
    });
  }

  private createTerminal(
    x: number,
    z: number,
    id: string,
    label: string,
    payloadId: string,
    glowMat: THREE.Material
  ): void {
    const y = this.physics.getTerrainHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.3, 0.35, 16),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 })
    );
    base.position.y = 0.18;
    group.add(base);

    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.6, 1.25, 16),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.9 })
    );
    column.position.y = 0.9;
    group.add(column);

    const holoGlobe = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.38, 1),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true })
    );
    holoGlobe.position.y = 1.95;
    group.add(holoGlobe);
    this.animatedMeshes.push(holoGlobe);

    const holoRing = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.045, 10, 28), glowMat);
    holoRing.rotation.x = Math.PI / 2;
    holoRing.position.y = 1.95;
    group.add(holoRing);
    this.animatedMeshes.push(holoRing);

    this.scene.add(group);
    this.physics.addCylinder(x, z, 1.1, 2.2);

    this.interactables.push({
      id,
      type: 'terminal',
      label,
      position: new THREE.Vector3(x, y, z),
      mesh: group,
      used: false,
      payloadId
    });
  }

  private createDatapad(x: number, z: number, id: string, label: string, loreId: string): void {
    const y = this.physics.getTerrainHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.32, 1.0, 12),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.85 })
    );
    pedestal.position.y = 0.5;
    group.add(pedestal);

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.26, 0),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    crystal.position.y = 1.3;
    group.add(crystal);
    this.animatedMeshes.push(crystal);

    this.scene.add(group);

    this.interactables.push({
      id,
      type: 'datapad',
      label,
      position: new THREE.Vector3(x, y, z),
      mesh: group,
      used: false,
      payloadId: loreId
    });
  }

  private createSupplyCache(x: number, z: number, id: string): void {
    const y = this.physics.getTerrainHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Sculpted Hexagonal Drop Pod Capsule instead of a rectangular box
    const podBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.78, 0.85, 6),
      new THREE.MeshStandardMaterial({ color: 0x263449, roughness: 0.35, metalness: 0.82 })
    );
    podBody.position.y = 0.42;
    podBody.castShadow = true;
    group.add(podBody);

    const domeLid = new THREE.Mesh(
      new THREE.SphereGeometry(0.64, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3, metalness: 0.85 })
    );
    domeLid.position.y = 0.82;
    group.add(domeLid);

    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.045, 8, 18),
      new THREE.MeshBasicMaterial({ color: 0xff9d00 })
    );
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.72;
    group.add(glowRing);

    this.scene.add(group);

    this.interactables.push({
      id,
      type: 'cache',
      label: 'Salvage Military Supply Pod',
      position: new THREE.Vector3(x, y, z),
      mesh: group,
      used: false
    });
  }

  private createOverloadPylon(
    x: number,
    z: number,
    id: string,
    nexusMat: THREE.Material,
    cyanNeon: THREE.Material
  ): void {
    const y = this.physics.getTerrainHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 3.2, 8), nexusMat);
    column.position.y = 1.6;
    column.castShadow = true;
    group.add(column);

    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.08, 10, 24), cyanNeon);
    coil.rotation.x = Math.PI / 2;
    coil.position.y = 2.6;
    group.add(coil);
    this.animatedMeshes.push(coil);

    this.scene.add(group);
    this.physics.addCylinder(x, z, 0.85, 3.4);

    this.interactables.push({
      id,
      type: 'overload_pylon',
      label: 'Discharge Core Overload Pylon (Stun NEXUS Prime)',
      position: new THREE.Vector3(x, y, z),
      mesh: group,
      used: false,
      cooldown: 0
    });
  }

  private buildAtmosphericAshParticles(): void {
    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = Math.random() * 24 + 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90 + 140;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.16,
      transparent: true,
      opacity: 0.45
    });

    this.ashParticles = new THREE.Points(geo, mat);
    this.scene.add(this.ashParticles);
  }

  public update(dt: number, playerPos: THREE.Vector3): { clockText: string; weatherText: string } {
    this.timeOfDay = (this.timeOfDay + dt * 0.004) % 1;

    for (const m of this.animatedMeshes) {
      m.rotation.y += dt * 1.4;
      m.rotation.z += dt * 0.8;
    }

    // Recharge overload pylons after cooldown
    for (const inter of this.interactables) {
      if (inter.type === 'overload_pylon' && inter.used && inter.cooldown !== undefined) {
        inter.cooldown -= dt;
        if (inter.cooldown <= 0) {
          inter.used = false;
          inter.cooldown = 0;
        }
      }
    }

    // Keep atmospheric ash centered around player
    if (this.ashParticles) {
      const posAttr = this.ashParticles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        let py = posAttr.getY(i) - dt * 1.2;
        if (py < playerPos.y) py = playerPos.y + 22;
        posAttr.setY(i, py);
      }
      posAttr.needsUpdate = true;
      this.ashParticles.position.x = playerPos.x * 0.15;
      this.ashParticles.position.z = playerPos.z - 140;
    }

    const totalMinutes = Math.floor(18 * 60 + this.timeOfDay * 360) % (24 * 60);
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');

    const weatherText =
      playerPos.z > 30
        ? 'Ionized Ashfall'
        : playerPos.z < -95
          ? 'Quantum Static'
          : 'Thermal Dust Storm';

    return { clockText: `${hh}:${mm}`, weatherText };
  }
}
