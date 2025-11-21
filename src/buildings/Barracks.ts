import Phaser from 'phaser';
import { Building, type BuildingConfig } from './Building';

export class Barracks extends Building {
    constructor(scene: Phaser.Scene) {
        const config: BuildingConfig = Barracks.getConfig();
        super(scene, config);
    }

    static getConfig(): BuildingConfig {
        return {
            name: 'Barracks',
            width: 100,
            height: 80,
            color: 0x3366ff,
            cost: 50,
            type: 'military',
            buildTime: 5000,
            description:
                'Trains units and unlocks engineer workers. Provides a small military stipend while standing.',
            unlockedWorkerTypes: ['engineer'],
            passiveIncomePerMinute: 30,
        };
    }
}
