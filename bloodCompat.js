function bloodCompatibilityChecker(Donor, Recipient) {
    if (Recipient == "A+") {
        if (Donor == "A+" || Donor == "A-" || Donor == "O+" || Donor == "O-") {
            return true;
        }
    } else if (Recipient == "A-") {
        if (Donor == "A-" || Donor == "O-") {
            return true;
        }
    } else if (Recipient == "B+") {
        if (Donor == "B+" || Donor == "B-" || Donor == "O-" || Donor == "O+") {
            return true;
        }
    } else if (Recipient == "B-") {
        if (Donor == "B-" || Donor == "O-") {
            return true;
        }
    } else if (Recipient == "AB+") {
        if (Donor == "A+" || Donor == "A-" || Donor == "B+" || Donor == "B-" || Donor == "AB+" || Donor == "AB-" || Donor == "O+" || Donor == "O-") {
            return true;
        }
    } else if (Recipient == "AB-") {
        if (Donor == "AB-" || Donor == "A-" || Donor == "B-" || Donor == "O-") {
            return true;
        }
    } else if (Recipient == "O+") {
        if (Donor == "O+" || Donor == "O-") {
            return true;
        }
    } else if (Recipient == "O-") {
        if (Donor == "O-") {
            return true;
        }
    }
    return false;
}

module.exports = bloodCompatibilityChecker;