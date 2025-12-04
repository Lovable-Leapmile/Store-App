export const updateOrderBeforeTransaction = async (
    orderId: number,
    userId: number | string,
    token: string
) => {
    const response = await fetch(
        `https://testhostsushil.leapmile.com/nanostore/orders?record_id=${orderId}`,
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
