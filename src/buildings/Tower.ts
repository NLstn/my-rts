import Phaser from 'phaser';
import { Building, type BuildingConfig } from './Building';

export class Tower extends Building {
    constructor(scene: Phaser.Scene) {
        const config: BuildingConfig = Tower.getConfig();
        super(scene, config);
    }

    static getConfig(): BuildingConfig {
        return {
            name: 'Tower',
            width: 60,
            height: 60,
            color: 0xcc4444,
            cost: 60,
            type: 'defense',
            buildTime: 5000,
            description: 'Basic defensive structure.',
        };
    }
}
