import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';

const BackButtonHandler = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const setupBackButton = async () => {
            // Add listener for the hardware back button
            const listener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                // Define root paths where back button should exit the app
                const rootPaths = ['/', '/login', '/home'];

                if (rootPaths.includes(location.pathname)) {
                    // If on a root page, exit the app
                    CapacitorApp.exitApp();
                } else {
                    // Otherwise, go back in history
                    navigate(-1);
                }
            });

            return listener;
        };

        const listenerPromise = setupBackButton();

        // Cleanup listener on unmount
        return () => {
            listenerPromise.then(listener => listener.remove());
        };
    }, [navigate, location]);

    return null; // This component doesn't render anything
};

export default BackButtonHandler;
