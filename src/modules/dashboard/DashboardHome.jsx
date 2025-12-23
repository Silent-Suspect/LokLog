import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { TrainFront, Binary, ShieldAlert } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import LiveClock from '../../components/LiveClock';

const DashboardHome = () => {
    const { user } = useUser();
    const isAdmin = useAdmin();
    const navigate = useNavigate();

    const apps = [
        {
            title: 'LokLog',
            description: 'Fahrtenbuch & Zeiterfassung',
            icon: TrainFront,
            color: 'text-accent-blue',
            bgColor: 'bg-accent-blue/10',
            borderColor: 'group-hover:border-accent-blue/50',
            btnText: 'Starten',
            path: '/loklog',
        },
        {
            title: 'Decoder',
            description: 'Betriebsstellen & Routen-Check',
            icon: Binary,
            color: 'text-accent-purple',
            bgColor: 'bg-accent-purple/10',
            borderColor: 'group-hover:border-accent-purple/50',
            btnText: 'Öffnen',
            path: '/decoder',
        },
    ];

    if (isAdmin) {
        apps.push({
            title: 'Admin',
            description: 'Station Manager & System',
            icon: ShieldAlert,
            color: 'text-red-500',
            bgColor: 'bg-red-500/10',
            borderColor: 'group-hover:border-red-500/50',
            btnText: 'Verwalten',
            path: '/admin',
        });
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <header className="space-y-2">
                <h1 className="text-4xl font-bold text-white">
                    Moin, <span className="text-accent-blue">{user?.firstName || 'Lokführer'}</span>!
                </h1>
                <p className="text-gray-400 text-lg">
                    Was steht heute an?
                </p>
                <div className="pt-2">
                    <LiveClock />
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {apps.map((app, index) => (
                    <div
                        key={index}
                        onClick={() => navigate(app.path)}
                        className={`
                            relative overflow-hidden
                            bg-card border border-gray-800 rounded-2xl p-6 
                            cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl
                            group ${app.borderColor}
                        `}
                    >
                        {/* Background Glow Effect */}
                        <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20 ${app.bgColor.replace('/10', '')}`}></div>

                        <div className="flex flex-col h-full justify-between relative z-10">
                            <div>
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${app.bgColor}`}>
                                    <app.icon size={32} className={app.color} />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">{app.title}</h3>
                                <p className="text-gray-400">{app.description}</p>
                            </div>

                            <div className="mt-8">
                                <span className={`text-sm font-bold uppercase tracking-wider ${app.color} group-hover:underline underline-offset-4`}>
                                    {app.btnText} &rarr;
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DashboardHome;
