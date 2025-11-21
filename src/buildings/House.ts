import Phaser from 'phaser';
import { Building, type BuildingConfig } from './Building';

export class House extends Building {
    constructor(scene: Phaser.Scene) {
        const config: BuildingConfig = {
            name: 'House',
            width: 80,
            height: 60,
            color: 0xffcc66,
            cost: 40,
            type: 'utility',
            buildTime: 4000,
            populationCapIncrease: 4,
        };
        super(scene, config);
    }
}
