import { Scene, Sound } from 'phaser';
import { GameEvent } from '../config/events';

export const MUSIC_TRACKS = ['track01', 'track02', 'track03'] as const;
export const MUSIC_VOLUME = 0.15;
export type MusicTrack = (typeof MUSIC_TRACKS)[number];

export class SoundManager {
    private scene: Scene;
    private warning?: Phaser.Sound.BaseSound;
    private warningTimer: Phaser.Time.TimerEvent | undefined;
    private musicIntro?: Phaser.Sound.BaseSound;
    private musicLoop?: Phaser.Sound.BaseSound;
    private musicTrack: MusicTrack;
    private isDestroyed: boolean = false;

    static pickMusicTrack() {
        return MUSIC_TRACKS[Math.floor(Math.random() * MUSIC_TRACKS.length)];
    }

    static preload(scene: Scene, musicTrack: MusicTrack) {
        scene.load.audio('tank-fire', [
            'sounds/sfx/tank_fire.ogg',
            'sounds/sfx/tank_fire.mp3',
        ]);
        scene.load.audio('block-destroy', [
            'sounds/sfx/block_destroy.ogg',
            'sounds/sfx/block_destroy.mp3',
        ]);
        scene.load.audio('barrel-destroy', [
            'sounds/sfx/barrel_destroy.ogg',
            'sounds/sfx/barrel_destroy.mp3',
        ]);
        scene.load.audio('gray-explosion', [
            'sounds/sfx/gray_explosion.ogg',
            'sounds/sfx/gray_explosion.mp3',
        ]);
        scene.load.audio('tank-destroy', [
            'sounds/sfx/tank_destroy.ogg',
            'sounds/sfx/tank_destroy.mp3',
        ]);
        scene.load.audio('tank-fire-fail', [
            'sounds/sfx/tank_fire_fail.ogg',
            'sounds/sfx/tank_fire_fail.mp3',
        ]);
        scene.load.audio('death-wall-explode', [
            'sounds/sfx/death_wall_explode.ogg',
            'sounds/sfx/death_wall_explode.mp3',
        ]);
        scene.load.audio('danger-warning', [
            'sounds/sfx/danger_warning.ogg',
            'sounds/sfx/danger_warning.mp3',
        ]);
        scene.load.audio('option-select', [
            'sounds/sfx/option_select.ogg',
            'sounds/sfx/option_select.mp3',
        ]);
        scene.load.audio('ammo-bar-complete', [
            'sounds/sfx/ammo_bar_complete.ogg',
            'sounds/sfx/ammo_bar_complete.mp3',
        ]);
        scene.load.audio(`music-${musicTrack}-intro`, [
            `sounds/music/${musicTrack}_intro.ogg`,
            `sounds/music/${musicTrack}_intro.mp3`,
        ]);
        scene.load.audio(`music-${musicTrack}-loop`, [
            `sounds/music/${musicTrack}_loop.ogg`,
            `sounds/music/${musicTrack}_loop.mp3`,
        ]);
    }

    constructor(scene: Scene, musicTrack: MusicTrack) {
        this.scene = scene;
        this.musicTrack = musicTrack;
        this.startMusic();

        this.scene.events.on(
            GameEvent.ProjectileFire,
            this.handleProjectileFired,
            this,
        );
        this.scene.events.on(
            GameEvent.BlockDestroy,
            this.handleBlockDestroy,
            this,
        );
        this.scene.events.on(
            GameEvent.BarrelDestroy,
            this.handleBarrelDestroy,
            this,
        );
        this.scene.events.on(
            GameEvent.ExplosionSmoke,
            this.handleGrayExplosion,
            this,
        );
        this.scene.events.on(
            GameEvent.TankDestroy,
            this.handleTankDestroy,
            this,
        );
        this.scene.events.on(
            GameEvent.ProjectileFireFail,
            this.handleProjectileFireFail,
            this,
        );
        this.scene.events.on(
            GameEvent.DeathWallExplode,
            this.handleDeathWallDestroy,
            this,
        );
        this.scene.events.on(
            GameEvent.DangerWarning,
            this.handleDangerWarning,
            this,
        );
        this.scene.events.on(
            GameEvent.DangerWarningFinish,
            this.handleDangerWarningFinish,
            this,
        );
        this.scene.events.on(
            GameEvent.OptionSelect,
            this.handleOptionSelect,
            this,
        );
        this.scene.events.on(
            GameEvent.AmmoBarComplete,
            this.handleAmmoBarComplete,
            this,
        );
        this.scene.events.on(
            GameEvent.ProjectileHitProjectile,
            this.handleProjectileHitProjectile,
            this,
        );
    }

    handleProjectileFired() {
        this.play('tank-fire', { volume: 0.4 });
    }

    handleBlockDestroy() {
        this.play('block-destroy', { volume: 0.4 });
    }

    handleBarrelDestroy() {
        this.play('barrel-destroy', { volume: 0.4 });
    }

    handleGrayExplosion() {
        this.play('gray-explosion', { volume: 0.4 });
    }

    handleTankDestroy() {
        this.play('tank-destroy', { volume: 0.4 });
    }

    handleProjectileFireFail() {
        this.play('tank-fire-fail', { volume: 0.1 });
    }

    handleDeathWallDestroy() {
        this.play('death-wall-explode', { volume: 0.4 });
    }

    handleOptionSelect() {
        this.play('option-select', { volume: 0.4 });
    }

    handleAmmoBarComplete() {
        this.play('ammo-bar-complete', { volume: 0.4 });
    }

    handleProjectileHitProjectile() {
        this.play('gray-explosion', { volume: 0.4 });
    }

    handleDangerWarning() {
        this.warning ??= this.scene.sound.add('danger-warning', {
            volume: 0.2,
        });
        if (this.warningTimer) return;
        this.warningTimer = this.scene.time.addEvent({
            delay: 1500,
            callback: () => {
                if (this.canPlay()) this.warning?.play();
            },
            loop: true,
        });
    }

    handleDangerWarningFinish() {
        this.warningTimer?.remove();
        this.warningTimer = undefined;
        this.warning?.stop();
        this.warning?.destroy();
        this.warning = undefined;
    }

    private play(key: string, config?: Phaser.Types.Sound.SoundConfig) {
        if (this.canPlay()) this.scene.sound.play(key, config);
    }

    private canPlay() {
        if (
            typeof document !== 'undefined' &&
            document.visibilityState === 'hidden'
        )
            return false;
        if (this.scene.sound.locked) return false;
        const ctx = (this.scene.sound as Phaser.Sound.WebAudioSoundManager)
            .context;
        return !ctx || ctx.state === 'running';
    }

    private startMusic() {
        const introKey = `music-${this.musicTrack}-intro`;
        const loopKey = `music-${this.musicTrack}-loop`;

        this.musicIntro = this.scene.sound.add(introKey, {
            volume: MUSIC_VOLUME,
        });
        this.musicLoop = this.scene.sound.add(loopKey, {
            volume: MUSIC_VOLUME,
            loop: true,
        });

        this.musicIntro.once(Sound.Events.COMPLETE, this.startMusicLoop, this);
        this.musicIntro.play();
    }

    private startMusicLoop() {
        if (this.isDestroyed) return;
        this.musicLoop?.play();
    }

    destroy() {
        this.isDestroyed = true;

        this.scene.events.off(
            GameEvent.ProjectileFire,
            this.handleProjectileFired,
            this,
        );
        this.scene.events.off(
            GameEvent.BlockDestroy,
            this.handleBlockDestroy,
            this,
        );
        this.scene.events.off(
            GameEvent.BarrelDestroy,
            this.handleBarrelDestroy,
            this,
        );
        this.scene.events.off(
            GameEvent.ExplosionSmoke,
            this.handleGrayExplosion,
            this,
        );
        this.scene.events.off(
            GameEvent.TankDestroy,
            this.handleTankDestroy,
            this,
        );
        this.scene.events.off(
            GameEvent.ProjectileFireFail,
            this.handleProjectileFireFail,
            this,
        );
        this.scene.events.off(
            GameEvent.DeathWallExplode,
            this.handleDeathWallDestroy,
            this,
        );
        this.scene.events.off(
            GameEvent.DangerWarning,
            this.handleDangerWarning,
            this,
        );
        this.scene.events.off(
            GameEvent.DangerWarningFinish,
            this.handleDangerWarningFinish,
            this,
        );
        this.scene.events.off(
            GameEvent.OptionSelect,
            this.handleOptionSelect,
            this,
        );
        this.scene.events.off(
            GameEvent.AmmoBarComplete,
            this.handleAmmoBarComplete,
            this,
        );
        this.scene.events.off(
            GameEvent.ProjectileHitProjectile,
            this.handleProjectileHitProjectile,
            this,
        );
        this.musicIntro?.off(Sound.Events.COMPLETE, this.startMusicLoop, this);
        this.musicIntro?.destroy();
        this.musicLoop?.destroy();
        this.musicIntro = undefined;
        this.musicLoop = undefined;
    }
}
