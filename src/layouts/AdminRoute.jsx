import { Navigate, Outlet } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';

const AdminRoute = ({ children }) => {
    const isAdmin = useAdmin();

    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    return children ? children : <Outlet />;
};

export default AdminRoute;
