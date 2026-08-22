# Role and permission matrix — Phase C baseline

| Capability | Student | Teacher | Institution admin | Superadmin |
|---|---|---|---|---|
| Read own profile | Yes | Yes | Yes | Yes |
| Read own school | Yes | Yes | Yes | Yes |
| Read own academic progress | Yes | N/A | N/A | N/A |
| Directly write mastery/XP/rank tables | No | No | No | No |
| Start/submit academic session through validated RPC | Yes | No | Operational only | Operational only |
| Read managed group roster | No | Yes, assigned groups | Yes, institution | Cross-institution only where explicitly authorized |
| Manage group membership | No | Only if explicitly delegated | Yes, institution | Yes |
| View institution ranking | Same school, authorized endpoint | Same school | Same school | Explicit admin scope |
| Access private audit/receipt tables directly from browser | No | No | No | No |

This matrix is the intended target. It is not marked validated until tested against a Supabase development branch with authenticated test accounts.
