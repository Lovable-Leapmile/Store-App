export const updateOrderBeforeTransaction = async (
    orderId: number,
    userId: number | string,
    token: string
) => {
    const response = await fetch(
        `https://amsstores1.leapmile.com/nanostore/orders?record_id=${orderId}`,
        {
            method: "PATCH",
            headers: {
                accept: "application/json",
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ user_id: Number(userId) }),
        }
    );

    if (!response.ok) {
        throw new Error("Failed to update order with user ID before transaction");
    }

    return response.json();
};

export const publishCameraEvent = async (
    trayId: string,
    userId: number | string,
    token: string
) => {
    const response = await fetch(
        `https://amsstores1.leapmile.com/pubsub/publish?topic=CAMERA_EVENTS`,
        {
            method: "POST",
            headers: {
                accept: "application/json",
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                event: "capture_snap",
                task_id: trayId,
                filename: `${trayId} - ${userId}`,
                max_secs: 60,
                camera_id: "AMS-Nano-Nano_Console_B",
                device_id: "AMS-Nano-Nano",
            }),
        }
    );

    if (!response.ok) {
        throw new Error("Failed to publish camera event");
    }

    return response.json();
};
