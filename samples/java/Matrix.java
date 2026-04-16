public class Matrix {
    public static int[][] transpose(int[][] m) {
        int rows = m.length;
        int cols = m[0].length;
        int[][] t = new int[cols][rows];
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                t[j][i] = m[i][j];
            }
        }
        return t;
    }

    public static int sum(int[][] m) {
        int total = 0;
        for (int[] row : m) {
            for (int v : row) total += v;
        }
        return total;
    }

    public static int trace(int[][] m) {
        int t = 0;
        int n = Math.min(m.length, m[0].length);
        for (int i = 0; i < n; i++) t += m[i][i];
        return t;
    }

    public static void print(int[][] m) {
        for (int[] row : m) {
            StringBuilder sb = new StringBuilder("  ");
            for (int v : row) sb.append(String.format("%4d", v));
            System.out.println(sb);
        }
    }
}
