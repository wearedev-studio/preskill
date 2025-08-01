import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext'; // Импортируем useUI
import styles from './Sidebar.module.css';
import { Home, Gamepad2, Trophy, User as UserIcon, Crown, ShieldCheck, LogOut } from 'lucide-react';
import Avatar from '../../components/common/Avatar'; // 1. Импортируем новый компонент


const Sidebar: React.FC = () => {
    const { user, logout } = useAuth();
    const { isSidebarOpen, setSidebarOpen } = useUI(); // Берем состояние и функцию из контекста

    const menuItems = [
        { path: '/', icon: Home, label: 'Dashboard' },
        { path: '/games', icon: Gamepad2, label: 'Games' },
        { path: '/tournaments', icon: Trophy, label: 'Tournaments' },
        { path: '/profile', icon: UserIcon, label: 'Profile' },
    ];
    
    const initials = <Avatar size="small" />
    
    const getNavLinkClass = ({ isActive }: { isActive: boolean }) => 
        `${styles.navLink} ${isActive ? styles.active : ''}`;

    const handleLinkClick = () => {
        // Закрываем сайдбар только если экран узкий (мобильная версия)
        if (window.innerWidth < 1024) {
             setSidebarOpen(false);
        }
    };

    return (
        <>
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            <div className={`${styles.sidebarContainer} ${isSidebarOpen ? styles.open : ''}`}>
                {/* <div className={styles.logoArea}> */}
                    <Link to="/" onClick={handleLinkClick} className={styles.logoArea}>
                        <div className={styles.logoIconContainer}><Crown /></div>
                        <div className={styles.logoText}>
                            <h1>Skill Game</h1>
                            <p>Game platform</p>
                        </div>
                    </Link>
                {/* </div> */}

                <nav className={styles.nav}>
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
                            onClick={handleLinkClick}
                            className={getNavLinkClass}
                            // ИСПРАВЛЕНИЕ: Убрали onClick={() => setIsOpen(false)} отсюда
                        >
                            <item.icon />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                    {user?.role === 'ADMIN' && (
                         <NavLink
                            to="/admin"
                            onClick={handleLinkClick}
                            className={getNavLinkClass}
                        >
                            <ShieldCheck />
                            <span>Admin tools(demo)</span>
                        </NavLink>
                    )}
                </nav>

                <div className={styles.profileSection}>
                     <div className={styles.profileInfo}>
                        <div className={styles.avatar}>{initials}</div>
                        <div>
                            <p className={styles.username}>{user?.username || 'Gamer'}</p>
                            <p className={styles.userStatus}>{user?.role === 'ADMIN' ? 'Admin' : 'Gamer'}</p>
                        </div>
                    </div>
                     <button onClick={() => { handleLinkClick(); logout(); }}className={`${styles.navLink} w-full mt-4`}>
                        <LogOut />
                        <span>Log out</span>
                    </button>
                </div>
            </div>
        </>
    );
};

export default Sidebar;