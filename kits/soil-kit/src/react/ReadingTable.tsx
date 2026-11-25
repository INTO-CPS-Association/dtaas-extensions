import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

/** One signal of a profile or a site, ready to show. */
export interface ReadingRow {
  readonly key: string;
  /** The depth range of a profile sensor, or what else the row is. */
  readonly depth?: string;
  readonly quantity: string;
  readonly device: string;
  readonly reading: string;
}

interface ReadingTableProps {
  /** The heading, such as `Profile P03` or `Site Greenhouse`. */
  readonly title: string;
  readonly rows: readonly ReadingRow[];
}

/** An id for the heading: letters, digits and dashes only. */
const headingId = (title: string) =>
  `soil-${title.replaceAll(/[^A-Za-z0-9]+/g, '-')}`;

/** The cells of a row, with the depth first when the table shows depths. */
const cellsOf = (row: ReadingRow, depths: boolean) => (
  <>
    {depths && <TableCell>{row.depth}</TableCell>}
    <TableCell>{row.quantity}</TableCell>
    <TableCell>{row.device}</TableCell>
    <TableCell align="right">{row.reading}</TableCell>
  </>
);

const HEADER: ReadingRow = {
  key: 'header',
  depth: 'Depth',
  quantity: 'Quantity',
  device: 'Device',
  reading: 'Latest Reading',
};

/**
 * The signals of one soil profile, downwards, or of one site. The depth
 * column shows only when a row has a depth. Knows nothing about DTaaS. The
 * container scrolls a wide table sideways on a narrow screen, so the page
 * itself never scrolls horizontally.
 */
function ReadingTable({ title, rows }: ReadingTableProps) {
  const heading = headingId(title);
  const depths = rows.some((row) => row.depth !== undefined);
  return (
    <section aria-labelledby={heading}>
      <Typography id={heading} variant="h6" component="h2" sx={{ mt: 2 }}>
        {title}
      </Typography>
      <TableContainer>
        <Table size="small" aria-labelledby={heading}>
          <TableHead>
            <TableRow>{cellsOf(HEADER, depths)}</TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>{cellsOf(row, depths)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </section>
  );
}

export default ReadingTable;
