#include <cctype>
#include <string>
#include "strings.h"

std::string reverse(const std::string &s) {
    return std::string(s.rbegin(), s.rend());
}

bool is_palindrome(const std::string &s) {
    std::string cleaned;
    for (char c : s) {
        if (std::isalnum(static_cast<unsigned char>(c))) {
            cleaned.push_back(std::tolower(static_cast<unsigned char>(c)));
        }
    }
    int i = 0;
    int j = static_cast<int>(cleaned.size()) - 1;
    while (i < j) {
        if (cleaned[i] != cleaned[j]) return false;
        i++;
        j--;
    }
    return true;
}
