import { useUser } from '@clerk/clerk-react';

export const useAdmin = () => {
    const { user } = useUser();

    // Check if the role in publicMetadata is 'admin'
    return user?.publicMetadata?.role === 'admin';
};
