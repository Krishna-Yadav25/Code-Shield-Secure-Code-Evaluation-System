import unittest

from plagiarism_detector import (
    tokenize_code,
    jaccard_similarity,
    compare_code
)


class TestPlagiarismDetector(unittest.TestCase):

    def test_identical_code(self):
        code = """
        #include <iostream>
        using namespace std;

        int main() {
            int total = 0;

            for (int i = 0; i < 10; i++) {
                total += i;
            }

            cout << total;
            return 0;
        }
        """

        result = compare_code(code, code)

        self.assertEqual(
            result["similarity_score"],
            100.0
        )

        self.assertTrue(result["flagged"])

    def test_comments_are_ignored(self):
        code_a = """
        int main() {
            // first comment
            return 0;
        }
        """

        code_b = """
        int main() {
            /* another comment */
            return 0;
        }
        """

        self.assertEqual(
            tokenize_code(code_a),
            tokenize_code(code_b)
        )

    def test_empty_code(self):
        result = compare_code("", "")

        self.assertEqual(
            result["similarity_score"],
            0.0
        )

        self.assertFalse(result["flagged"])

    def test_identical_code_more_similar_than_different_code(self):
        code_a = """
        int main() {
            int sum = 0;
            for (int i = 0; i < 10; i++) {
                sum += i;
            }
            return sum;
        }
        """

        code_b = """
        int main() {
            int number;
            cin >> number;
            cout << number;
            return 0;
        }
        """

        same_score = jaccard_similarity(
            code_a,
            code_a
        )

        different_score = jaccard_similarity(
            code_a,
            code_b
        )

        self.assertGreater(
            same_score,
            different_score
        )


if __name__ == "__main__":
    unittest.main()