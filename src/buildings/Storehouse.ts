import Phaser from 'phaser';
import { Building, type BuildingConfig } from './Building';

export class Storehouse extends Building {
    constructor(scene: Phaser.Scene) {
        const config: BuildingConfig = Storehouse.getConfig();
        super(scene, config);
    }

    static getConfig(): BuildingConfig {
        return {
            name: 'Storehouse',
            width: 80,
            height: 70,
            color: 0x33cc99,
            cost: 45,
            type: 'dropoff',
            buildTime: 4500,
            description:
                'Provides a nearby drop-off point and boosts harvesting speed for nodes within its yard.',
            providesDropOff: true,
            harvestBonus: {
                radius: 200,
                multiplier: 1.25,
            },
        };
    }
}
