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
            type: 'housing',
            buildTime: 4000,
            description: 'Increases population cap by 4.',
            populationCapIncrease: 4,
            populationBonus: 4,
        };
        super(scene, config);
    }
}
