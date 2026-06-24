import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';

export function useTour(steps, options = {}) {
    const driverRef = useRef(null);

    useEffect(() => {
        if (!steps || steps.length === 0) return;

        driverRef.current = driver({
            showProgress: true,
            allowClose: true,
            steps,
            ...options,
        });

        return () => {
            driverRef.current?.destroy();
        };
    }, [steps]);

    return {
        start: () => driverRef.current?.drive(),
        destroy: () => driverRef.current?.destroy(),
    };
}