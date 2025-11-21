import Phaser from 'phaser';
import type { Building } from '../buildings/Building';
import type { ResourceNode, ResourceType } from '../units/Worker';

export type ResourceSettings = {
    color: number;
    label: string;
    startingAmount: number;
    yieldPerTick: number;
    depletionRate: number;
    respawnDelay: number;
};

export interface ResourceManagerConfig {
    initialSpawnCount: number;
    nodesPerInterval: number;
    maxActiveNodes: number;
    respawnIntervalMs: number;
    minDistanceFromBase: number;
    maxDistanceFromBase: number;
    minDistanceBetweenNodes: number;
}

export const RESOURCE_CONFIGS: Record<ResourceType, ResourceSettings> = {
    wood: {
        color: 0x2f8f2f,
        label: 'Wood',
        startingAmount: 180,
        yieldPerTick: 8,
        depletionRate: 6,
        respawnDelay: 12000,
    },
    stone: {
        color: 0x808080,
        label: 'Stone',
        startingAmount: 140,
        yieldPerTick: 6,
        depletionRate: 7,
        respawnDelay: 15000,
    },
    food: {
        color: 0xd97706,
        label: 'Food',
        startingAmount: 160,
        yieldPerTick: 7,
        depletionRate: 5,
        respawnDelay: 10000,
    },
};

export interface ResourceManagerDependencies {
    scene: Phaser.Scene;
    gridSize: number;
    basePosition: Phaser.Math.Vector2;
    worldBounds: { width: number; height: number };
    getBaseSpawnArea: () => Phaser.Geom.Rectangle;
    getConstructionSites: () => { base: Phaser.GameObjects.Rectangle }[];
    getPlacedBuildings: () => Building[];
    showFeedback: (message: string) => void;
    onNodeDepleted: (node: ResourceNode) => void;
    onNodeRightClick?: (node: ResourceNode, pointer: Phaser.Input.Pointer) => void;
}

export class ResourceManager {
    private readonly scene: Phaser.Scene;
    private readonly gridSize: number;
    private readonly basePosition: Phaser.Math.Vector2;
    private readonly worldBounds: { width: number; height: number };
    private readonly config: ResourceManagerConfig;
    private readonly getBaseSpawnArea: () => Phaser.Geom.Rectangle;
    private readonly getConstructionSites: () => { base: Phaser.GameObjects.Rectangle }[];
    private readonly getPlacedBuildings: () => Building[];
    private readonly showFeedback: (message: string) => void;
    private readonly onNodeDepleted: (node: ResourceNode) => void;
    private readonly onNodeRightClick?: (node: ResourceNode, pointer: Phaser.Input.Pointer) => void;
    private resourceNodes: ResourceNode[] = [];
    private nodeIdCounter: number = 0;
    private respawnTimer?: Phaser.Time.TimerEvent;

    constructor(config: ResourceManagerConfig, deps: ResourceManagerDependencies) {
        this.scene = deps.scene;
        this.gridSize = deps.gridSize;
        this.basePosition = deps.basePosition;
        this.worldBounds = deps.worldBounds;
        this.config = config;
        this.getBaseSpawnArea = deps.getBaseSpawnArea;
        this.getConstructionSites = deps.getConstructionSites;
        this.getPlacedBuildings = deps.getPlacedBuildings;
        this.showFeedback = deps.showFeedback;
        this.onNodeDepleted = deps.onNodeDepleted;
        this.onNodeRightClick = deps.onNodeRightClick;
    }

    public initialize() {
        for (let i = 0; i < this.config.initialSpawnCount; i++) {
            this.spawnProceduralResourceNode();
        }

        this.startResourceRespawnLoop();
    }

    public shutdown() {
        this.resourceNodes.forEach((node) => {
            node.respawnTimer?.remove();
            node.respawnTimer = undefined;
        });
        this.respawnTimer?.remove();
    }

    public getNodes() {
        return this.resourceNodes;
    }

    public getNodeAt(x: number, y: number) {
        return this.resourceNodes.find((node) => node.sprite.getBounds().contains(x, y));
    }

    public hasCollisionWithResource(bounds: Phaser.Geom.Rectangle) {
        return this.resourceNodes.some((node) => {
            const nodeBounds = node.sprite.getBounds();
            return Phaser.Geom.Intersects.RectangleToRectangle(bounds, nodeBounds);
        });
    }

    public findNearestResource(position: Phaser.Math.Vector2): ResourceNode | undefined {
        let nearest: ResourceNode | undefined;
        let shortest = Number.POSITIVE_INFINITY;

        this.resourceNodes.forEach((node) => {
            if (node.amount <= 0) {
                return;
            }

            const distance = Phaser.Math.Distance.Between(position.x, position.y, node.sprite.x, node.sprite.y);
            if (distance < shortest) {
                shortest = distance;
                nearest = node;
            }
        });

        return nearest;
    }

    public updateResourceLabel(node: ResourceNode) {
        const settings = RESOURCE_CONFIGS[node.type];
        node.label.setText(`${settings.label}: ${Math.max(0, node.amount)}`);
        node.label.setColor(node.amount > 0 ? '#ffffff' : '#ffb3b3');
    }

    public handleResourceDepleted(node: ResourceNode) {
        const settings = RESOURCE_CONFIGS[node.type];
        node.amount = 0;
        node.sprite.disableInteractive();
        node.label.setText(`${settings.label}: Depleted`);
        node.label.setColor('#ff6666');
        this.showFeedback(`${settings.label} node depleted. Respawning soon...`);

        this.onNodeDepleted(node);

        if (node.respawnTimer) {
            node.respawnTimer.remove();
        }
        node.respawnTimer = this.scene.time.delayedCall(node.respawnDelay, () => this.respawnResourceNode(node));
    }

    public createResourceNode(x: number, y: number, type: ResourceType) {
        const settings = RESOURCE_CONFIGS[type];
        const amount = settings.startingAmount + Phaser.Math.Between(-20, 20);
        const strokeColor = Phaser.Display.Color.IntegerToColor(settings.color).brighten(20).color;

        const resource = this.scene.add.circle(x, y, 20, settings.color);
        resource.setStrokeStyle(2, strokeColor);
        resource.setInteractive({ useHandCursor: true });

        const label = this.scene.add
            .text(x, y - 35, `${settings.label}: ${amount}`, {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 4, y: 2 },
            })
            .setOrigin(0.5);

        const node: ResourceNode = {
            id: this.nodeIdCounter++,
            sprite: resource,
            label,
            amount,
            type,
            yieldPerTick: settings.yieldPerTick,
            depletionRate: settings.depletionRate,
            respawnDelay: settings.respawnDelay,
            color: settings.color,
        };

        resource.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown() && this.onNodeRightClick) {
                this.onNodeRightClick(node, pointer);
            }
        });

        this.resourceNodes.push(node);

        return node;
    }

    public spawnProceduralResourceNode(): ResourceNode | undefined {
        const attempts = 30;
        for (let i = 0; i < attempts; i++) {
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = Phaser.Math.Between(this.config.minDistanceFromBase, this.config.maxDistanceFromBase);

            const targetX = this.basePosition.x + Math.cos(angle) * distance;
            const targetY = this.basePosition.y + Math.sin(angle) * distance;

            const snappedX = Phaser.Math.Snap.To(targetX, this.gridSize);
            const snappedY = Phaser.Math.Snap.To(targetY, this.gridSize);

            const clampedX = Phaser.Math.Clamp(snappedX, 20, this.worldBounds.width - 20);
            const clampedY = Phaser.Math.Clamp(snappedY, 20, this.worldBounds.height - 20);

            if (!this.isValidResourceSpawn(clampedX, clampedY)) {
                continue;
            }

            const types: ResourceType[] = ['wood', 'stone', 'food'];
            const randomType = types[Phaser.Math.Between(0, types.length - 1)];
            return this.createResourceNode(clampedX, clampedY, randomType);
        }

        return undefined;
    }

    public generateStartingResources(
        clusterConfigs: { type: ResourceType; count: number; distance: number; spread: number }[],
    ) {
        clusterConfigs.forEach((cluster, index) => {
            const angle = Phaser.Math.DegToRad((360 / clusterConfigs.length) * index + Phaser.Math.Between(-10, 10));
            const center = new Phaser.Math.Vector2(
                this.basePosition.x + Math.cos(angle) * cluster.distance,
                this.basePosition.y + Math.sin(angle) * cluster.distance,
            );

            for (let i = 0; i < cluster.count; i += 1) {
                const offset = new Phaser.Math.Vector2(
                    Phaser.Math.Between(-cluster.spread, cluster.spread),
                    Phaser.Math.Between(-cluster.spread, cluster.spread),
                );
                this.createResourceNode(center.x + offset.x, center.y + offset.y, cluster.type);
            }
        });
    }

    private startResourceRespawnLoop() {
        if (this.respawnTimer) {
            return;
        }

        this.respawnTimer = this.scene.time.addEvent({
            delay: this.config.respawnIntervalMs,
            loop: true,
            callback: () => this.spawnResourceNodesForInterval(),
        });
    }

    private spawnResourceNodesForInterval() {
        const openSlots = Math.max(0, this.config.maxActiveNodes - this.resourceNodes.length);
        const nodesToSpawn = Math.min(this.config.nodesPerInterval, openSlots);

        let spawned = 0;
        for (let i = 0; i < nodesToSpawn; i++) {
            const node = this.spawnProceduralResourceNode();
            if (node) {
                spawned++;
            }
        }

        if (spawned > 0) {
            this.announceNewResourceNodes(spawned);
        }
    }

    private announceNewResourceNodes(count: number) {
        const message =
            count === 1
                ? 'A new resource node has appeared nearby.'
                : `${count} new resource nodes have appeared around your base.`;
        this.showFeedback(message);
    }

    private isValidResourceSpawn(x: number, y: number) {
        const distanceToBase = Phaser.Math.Distance.Between(x, y, this.basePosition.x, this.basePosition.y);
        if (distanceToBase < this.config.minDistanceFromBase || distanceToBase > this.config.maxDistanceFromBase) {
            return false;
        }

        if (this.getBaseSpawnArea().contains(x, y)) {
            return false;
        }

        const nodeBounds = new Phaser.Geom.Rectangle(x - 22, y - 22, 44, 44);

        const overlapsSite = this.getConstructionSites().some((site) => {
            const bounds = site.base.getBounds();
            return Phaser.Geom.Intersects.RectangleToRectangle(nodeBounds, bounds);
        });

        if (overlapsSite) {
            return false;
        }

        const overlapsBuilding = this.getPlacedBuildings().some((building) => {
            const sprite = building.getSprite();
            if (!sprite) return false;
            const bounds = sprite.getBounds();
            return Phaser.Geom.Intersects.RectangleToRectangle(nodeBounds, bounds);
        });

        if (overlapsBuilding) {
            return false;
        }

        const collidesWithNode = this.resourceNodes.some((node) => {
            const distanceToNode = Phaser.Math.Distance.Between(x, y, node.sprite.x, node.sprite.y);
            return distanceToNode < this.config.minDistanceBetweenNodes;
        });

        return !collidesWithNode;
    }

    private respawnResourceNode(node: ResourceNode) {
        const settings = RESOURCE_CONFIGS[node.type];
        const strokeColor = Phaser.Display.Color.IntegerToColor(settings.color).brighten(20).color;
        node.amount = settings.startingAmount + Phaser.Math.Between(-20, 20);
        node.sprite.setFillStyle(settings.color);
        node.sprite.setStrokeStyle(2, strokeColor);
        node.sprite.setInteractive({ useHandCursor: true });
        node.label.setColor('#ffffff');
        this.updateResourceLabel(node);
        this.showFeedback(`${settings.label} node has respawned.`);
        node.respawnTimer = undefined;
    }
}
