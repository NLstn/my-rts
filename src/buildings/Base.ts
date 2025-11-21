import Phaser from 'phaser';
import { Building, type BuildingConfig } from './Building';

export class Base extends Building {
    constructor(scene: Phaser.Scene) {
        const config: BuildingConfig = {
            name: 'Base',
            width: 80,
            height: 80,
            color: 0x8b4513,
            cost: 0,
            type: 'hq',
            buildTime: 0,
            dropOff: true,
        };
        super(scene, config);
    }
}
