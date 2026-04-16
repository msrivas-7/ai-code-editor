#include <iostream>
#include <vector>
#include "strings.h"

int main() {
    std::vector<std::string> samples = {
        "racecar",
        "hello",
        "A man a plan a canal Panama",
        "not a palindrome",
        "step on no pets",
    };

    for (const auto &s : samples) {
        std::cout << (is_palindrome(s) ? "[yes] " : "[no ] ")
                  << s << "  (reversed: " << reverse(s) << ")\n";
    }
    return 0;
}
