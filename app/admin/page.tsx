import Link from 'next/link';
import AdminApp from '../../components/admin-app';

const floatingActionStyle = {
  borderRadius: 999,
  padding: '10px 14px',
  background: '#176a45',
  color: '#fff',
  fontWeight: 800,
  textDecoration: 'none',
  boxShadow: '0 8px 24px rgba(0,0,0,.16)',
} as const;

export default function AdminPage() {
  return <>
    <AdminApp />
    <div
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        zIndex: 80,
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
      }}
    >
      <Link href="/admin/estudiantes/nuevo" style={floatingActionStyle}>
        Nuevo estudiante
      </Link>
      <Link href="/admin/vocabulario" style={floatingActionStyle}>
        Catálogo completo
      </Link>
    </div>
  </>;
}
