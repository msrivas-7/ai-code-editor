public class Main {
    public static void main(String[] args) {
        int[][] m = {
            {1, 2, 3},
            {4, 5, 6},
            {7, 8, 9},
        };

        System.out.println("original:");
        Matrix.print(m);

        System.out.println("\ntranspose:");
        Matrix.print(Matrix.transpose(m));

        System.out.println("\nsum = " + Matrix.sum(m));
        System.out.println("trace = " + Matrix.trace(m));
    }
}
