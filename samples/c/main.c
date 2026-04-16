#include <stdio.h>
#include "mathx.h"

int main(void) {
    int nums[] = {3, 1, 4, 1, 5, 9, 2, 6, 5, 3};
    int n = sizeof(nums) / sizeof(nums[0]);

    printf("sum    = %d\n", array_sum(nums, n));
    printf("max    = %d\n", array_max(nums, n));
    printf("5! = %ld\n", factorial(5));
    printf("10! = %ld\n", factorial(10));
    return 0;
}
