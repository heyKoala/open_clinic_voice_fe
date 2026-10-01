const notification_sound = new Audio("src/components/sounds/mixkit-long-pop-2358.wav");
export const playnotificationsound = (): void => {
    notification_sound.currentTime = 0;

    notification_sound.play().catch((error: Error) => {
        console.warn("Playback prevented by browser autoplay policy:", error.message);
    });
};

