import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

/** One sensor of a profile, ready to show. */
export interface SensorRow {
  readonly key: string;
  readonly depth: string;
  readonly quantity: string;
  readonly device: string;
  readonly reading: string;
}

interface ProfileTableProps {
  readonly profile: string;
  readonly rows: readonly SensorRow[];
}

const HEAD = (
  <TableHead>
    <TableRow>
      <TableCell>Depth</TableCell>
      <TableCell>Quantity</TableCell>
      <TableCell>Device</TableCell>
      <TableCell align="right">Latest Reading</TableCell>
    </TableRow>
  </TableHead>
);

/**
 * The sensors of one soil profile, downwards. Knows nothing about DTaaS. The
 * container scrolls a wide table sideways on a narrow screen, so the page
 * itself never scrolls horizontally.
 */
function ProfileTable({ profile, rows }: ProfileTableProps) {
  const heading = `profile-${profile}`;
  return (
    <section aria-labelledby={heading}>
      <Typography id={heading} variant="h6" component="h2" sx={{ mt: 2 }}>
        Profile {profile}
      </Typography>
      <TableContainer>
        <Table size="small" aria-labelledby={heading}>
          {HEAD}
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.depth}</TableCell>
                <TableCell>{row.quantity}</TableCell>
                <TableCell>{row.device}</TableCell>
                <TableCell align="right">{row.reading}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </section>
  );
}

export default ProfileTable;
