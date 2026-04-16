#include "mathx.h"

int array_sum(const int *arr, int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += arr[i];
    }
    return total;
}

int array_max(const int *arr, int n) {
    int best = arr[0];
    for (int i = 1; i < n; i++) {
        if (arr[i] > best) best = arr[i];
    }
    return best;
}

long factorial(int n) {
    long r = 1;
    for (int i = 2; i <= n; i++) {
        r *= i;
    }
    return r;
}
