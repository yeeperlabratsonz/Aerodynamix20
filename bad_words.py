import re

# Words that are not allowed in posts on Dynamix Connect.
# This includes racist slurs and common curse words.
BAD_WORDS = {
    # racist slurs and hate speech
    'nigger', 'nigga', 'chink', 'faggot', 'fag', 'retard', 'kike', 'spic', 'wetback',
    'gook', 'coon', 'raghead', 'towelhead', 'nazi', 'heil',
    # common curse words
    'fuck', 'fucking', 'fucked', 'shit', 'damn', 'bitch', 'ass', 'asshole',
    'bastard', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'cock', 'piss',
    'hell', 'retarded', 'stupid', 'idiot', 'dumbass', 'dumb',
}

_WORD_RE = re.compile(r"[a-zA-Z']+")


def contains_bad_words(text):
    if not text:
        return False
    for match in _WORD_RE.finditer(text.lower()):
        word = match.group(0).strip("'")
        if word in BAD_WORDS:
            return True
    return False


def censor_bad_words(text):
    if not text:
        return text

    def replace(match):
        word = match.group(0)
        if word.lower().strip("'") in BAD_WORDS:
            return '*' * len(word)
        return word

    return _WORD_RE.sub(replace, text)
