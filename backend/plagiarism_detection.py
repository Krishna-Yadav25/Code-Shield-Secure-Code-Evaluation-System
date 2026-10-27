
import re

DEFAULT_THRESHOLD = 0.70      # 70%
MIN_TOKENS = 20               # isse chhota code flag nahi hota
SHINGLE_SIZE = 5
MIN_MATCH_LINE_TOKENS = 4     # line match highlight ke liye minimum tokens


# ---------------------------------------------------------
# REGEX
# ---------------------------------------------------------

# Identifiers, numbers, operators and punctuation.
TOKEN_RE = re.compile(
    r"""
    (?:[A-Za-z_]\w*)
    |(?:\d+(?:\.\d+)?)
    |(?:==|!=|<=|>=|\+\+|--|&&|\|\||->|::|\+=|-=|\*=|/=|%=|<<|>>)
    |[^\s]
    """,
    re.VERBOSE,
)

# Comments aur string / char literals ek saath match hote hain, taaki
# string ke andar "//" ko comment na samjha jaye.
_COMMENT = r"//[^\n]*|/\*[\s\S]*?\*/"
_DOUBLE_QUOTED = r'"(?:\\.|[^"\\\n])*"'
_SINGLE_QUOTED = r"'(?:\\.|[^'\\\n])*'"

CLEAN_RE = re.compile(
    "|".join([_COMMENT, _DOUBLE_QUOTED, _SINGLE_QUOTED])
)

PREPROCESSOR_RE = re.compile(
    r"^[ \t]*#[ \t]*(?:include|define|pragma|ifdef|ifndef|endif|"
    r"undef|if|else|elif|import)\b[^\n]*",
    re.MULTILINE,
)

USING_NAMESPACE_RE = re.compile(r"\busing\s+namespace\s+std\s*;")

HASH_COMMENT_RE = re.compile(r"#[^\n]*")


# ---------------------------------------------------------
# WORDS JO NORMALIZE NAHI HOTE
# (language ke keywords aur common library naam)
# ---------------------------------------------------------

KEEP_WORDS = {
    # C / C++
    "int", "long", "short", "double", "float", "char", "bool", "void",
    "unsigned", "signed", "auto", "const", "static", "struct", "class",
    "enum", "union", "typedef", "using", "namespace", "template",
    "typename", "public", "private", "protected", "virtual", "operator",
    "if", "else", "for", "while", "do", "switch", "case", "default",
    "break", "continue", "return", "goto", "true", "false", "nullptr",
    "NULL", "new", "delete", "sizeof", "this", "try", "catch", "throw",
    "main", "std", "cin", "cout", "cerr", "endl", "scanf", "printf",
    "vector", "string", "map", "set", "unordered_map", "unordered_set",
    "pair", "queue", "stack", "deque", "priority_queue", "array",
    "sort", "reverse", "swap", "min", "max", "abs", "pow", "sqrt",
    "size", "push_back", "pop_back", "begin", "end", "size_t",
    "first", "second", "make_pair",
    # Java
    "String", "System", "out", "println", "print", "Scanner", "Integer",
    "ArrayList", "HashMap", "final", "extends", "implements", "import",
    "package", "interface", "boolean", "byte",
    # Python
    "def", "elif", "in", "not", "and", "or", "is", "None", "True",
    "False", "range", "len", "input", "lambda", "pass", "yield",
    "from", "as", "with", "while", "global", "del", "assert",
    # placeholder jo cleaning se aata hai
    "LITERAL",
}


# ---------------------------------------------------------
# CLEANING + TOKENIZING
# ---------------------------------------------------------

def _clean_code(code):
    """
    Comments, literals aur boilerplate hatata hai.
    Line numbering same rehti hai (newlines nahi hatte).
    """

    def replace(match):
        text = match.group(0)

        if text.startswith(("//", "/*")):
            return " " + "\n" * text.count("\n")

        return " LITERAL "

    code = CLEAN_RE.sub(replace, code)
    code = PREPROCESSOR_RE.sub("", code)
    code = USING_NAMESPACE_RE.sub("", code)
    code = HASH_COMMENT_RE.sub(" ", code)

    return code


def _normalize_tokens(tokens):
    """Keywords rakho, baaki sab identifiers ko ID bana do."""

    normalized = []

    for token in tokens:
        first = token[0]

        if (first.isalpha() or first == "_") and token not in KEEP_WORDS:
            normalized.append("ID")
        else:
            normalized.append(token)

    return normalized


def tokenize_code(code, normalize=True):
    """Code ko tokens ki list mein badlo."""

    if not isinstance(code, str) or not code.strip():
        return []

    tokens = TOKEN_RE.findall(_clean_code(code))

    return _normalize_tokens(tokens) if normalize else tokens


def create_shingles(tokens, size=SHINGLE_SIZE):
    """Lagatar tokens ke groups ka set banao."""

    if not tokens:
        return set()

    if len(tokens) < size:
        return {tuple(tokens)}

    return {
        tuple(tokens[i:i + size])
        for i in range(len(tokens) - size + 1)
    }


# ---------------------------------------------------------
# SIMILARITY
# ---------------------------------------------------------

def analyze_code(code):
    """
    Ek baar tokenize karke shingles bana do.
    Bahut saare pairs compare karte waqt yahi reuse hota hai.
    """

    tokens = tokenize_code(code)

    return {
        "token_count": len(tokens),
        "shingles": create_shingles(tokens),
    }


def jaccard_from_shingles(shingles_a, shingles_b):
    """Do shingle sets ki Jaccard similarity (0 se 1)."""

    if not shingles_a or not shingles_b:
        return 0.0

    union = shingles_a | shingles_b

    if not union:
        return 0.0

    return len(shingles_a & shingles_b) / len(union)


def jaccard_similarity(code_a, code_b):
    """Do code samples ki Jaccard similarity (0 se 1)."""

    return jaccard_from_shingles(
        analyze_code(code_a)["shingles"],
        analyze_code(code_b)["shingles"],
    )


def compare_analyzed(analysis_a, analysis_b, threshold=DEFAULT_THRESHOLD):
    """analyze_code() ke result do compare karo."""

    similarity = jaccard_from_shingles(
        analysis_a["shingles"],
        analysis_b["shingles"],
    )

    enough_tokens = (
        analysis_a["token_count"] >= MIN_TOKENS
        and analysis_b["token_count"] >= MIN_TOKENS
    )

    return {
        "similarity_score": round(similarity * 100, 2),
        "flagged": bool(enough_tokens and similarity >= threshold),
        "token_count_1": analysis_a["token_count"],
        "token_count_2": analysis_b["token_count"],
        "threshold_percent": round(threshold * 100, 2),
    }


def compare_code(code_a, code_b, threshold=DEFAULT_THRESHOLD):
    """Do submissions compare karke report do."""

    return compare_analyzed(
        analyze_code(code_a),
        analyze_code(code_b),
        threshold,
    )


# ---------------------------------------------------------
# MATCHING LINES (side-by-side highlight ke liye)
# ---------------------------------------------------------

def _line_keys(code):
    """{line_number: normalized line} (sirf kaam ki lines)."""

    if not isinstance(code, str) or not code.strip():
        return {}

    keys = {}

    for number, line in enumerate(_clean_code(code).split("\n"), start=1):
        tokens = _normalize_tokens(TOKEN_RE.findall(line))

        if len(tokens) >= MIN_MATCH_LINE_TOKENS:
            keys[number] = " ".join(tokens)

    return keys


def matching_lines(code_a, code_b):
    """
    Dono codes ki woh line numbers (1 se shuru) jo doosre code mein
    bhi (naam badalne ke baad bhi) maujood hain.
    """

    keys_a = _line_keys(code_a)
    keys_b = _line_keys(code_b)

    values_a = set(keys_a.values())
    values_b = set(keys_b.values())

    lines_a = sorted(n for n, key in keys_a.items() if key in values_b)
    lines_b = sorted(n for n, key in keys_b.items() if key in values_a)

    return lines_a, lines_b