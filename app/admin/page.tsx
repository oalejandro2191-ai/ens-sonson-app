import Link from 'next/link';
import AdminApp from '../../components/admin-app';

export default function AdminPage() {
  return <>
    <AdminApp />
    <Link
      href="/admin/vocabulario"
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        zIndex: 80,
        borderRadius: 999,
        padding: '10px 14px',
        background: '#176a45',
        color: '#fff',
        fontWeight: 800,
        textDecoration: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,.16)',
      }}
    >
      Catálogo completo
    </Link>
  </>;
}
