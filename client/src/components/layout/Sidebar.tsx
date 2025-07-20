import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext'; // Импортируем useUI
import styles from './Sidebar.module.css';
import { Home, Gamepad2, Trophy, User as UserIcon, Crown, ShieldCheck, LogOut } from 'lucide-react';

const Sidebar: React.FC = () => {
    const { user, logout } = useAuth();
    const { isSidebarOpen, setSidebarOpen } = useUI(); // Берем состояние и функцию из контекста

    const menuItems = [
        { path: '/', icon: Home, label: 'Панель управления' },
        { path: '/games', icon: Gamepad2, label: 'Игры' },
        { path: '/tournaments', icon: Trophy, label: 'Турниры' },
        { path: '/profile', icon: UserIcon, label: 'Настройки профиля' },
    ];
    
    const initials = user?.username ? user.username.substring(0, 2).toUpperCase() : '??';
    
    const getNavLinkClass = ({ isActive }: { isActive: boolean }) => 
        `${styles.navLink} ${isActive ? styles.active : ''}`;

    return (
        <>
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            <div className={`${styles.sidebarContainer} ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* <div className={styles.logoArea}> */}
                    <Link to="/" className={styles.logoArea}>
                        <div className={styles.logoIconContainer}><Crown /></div>
                        <div className={styles.logoText}>
                            <h1>Skill Games</h1>
                            <p>Игровая платформа</p>
                        </div>
                    </Link>
                {/* </div> */}

                <nav className={styles.nav}>
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
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
                            className={getNavLinkClass}
                        >
                            <ShieldCheck />
                            <span>Админка</span>
                        </NavLink>
                    )}
                </nav>

                <div className={styles.profileSection}>
                     <div className={styles.profileInfo}>
                        <div className={styles.avatar}>{initials}</div>
                        <div>
                            <p className={styles.username}>{user?.username || 'Игрок'}</p>
                            <p className={styles.userStatus}>{user?.role === 'ADMIN' ? 'Администратор' : 'Участник'}</p>
                        </div>
                    </div>
                     <button onClick={logout} className={`${styles.navLink} w-full mt-4`}>
                        <LogOut />
                        <span>Выйти</span>
                    </button>
                </div>
            </div>
        </>
    );
};

export default Sidebar;