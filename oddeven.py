import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

print("### Machine Learning for Even/Odd Prediction ###")

# 1. Data Generation
# Generate a dataset of numbers and their even/odd labels
# Even numbers will be labeled 0, odd numbers will be labeled 1

# Generate 25 random integers between 1 and 100
numbers = np.random.randint(1, 101, 25)

# Create labels: 0 for even, 1 for odd
labels = numbers % 2

# Reshape numbers to be a 2D array, as scikit-learn expects feature inputs to be 2D
X = numbers.reshape(-1, 1)
y = labels

# Split data into training (20 examples) and testing (5 examples)
# Using a fixed random_state for reproducibility
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=5, train_size=20, random_state=42, shuffle=True)

print(f"\nTraining Data ({len(X_train)} examples):")
for i in range(len(X_train)):
    print(f"  Number: {X_train[i][0]}, Label: {'Odd' if y_train[i] == 1 else 'Even'}")

print(f"\nTesting Data ({len(X_test)} examples):")
for i in range(len(X_test)):
    print(f"  Number: {X_test[i][0]}, Actual Label: {'Odd' if y_test[i] == 1 else 'Even'}")

# 2. Build and Train the Model
# We'll use Logistic Regression, a simple yet powerful classification algorithm
model = LogisticRegression()

print("\nTraining the model...")
model.fit(X_train, y_train)
print("Model training complete.")

# 3. Test the Model
print("\nMaking predictions on the test set:")
predictions = model.predict(X_test)

# 4. Evaluate the Model
print("\nEvaluation Results:")
for i in range(len(X_test)):
    predicted_label = 'Odd' if predictions[i] == 1 else 'Even'
    actual_label = 'Odd' if y_test[i] == 1 else 'Even'
    print(f"  Number: {X_test[i][0]}, Predicted: {predicted_label}, Actual: {actual_label}, {'Correct' if predicted_label == actual_label else 'Incorrect'}")

accuracy = np.mean(predictions == y_test)
print(f"\nOverall Accuracy on test set: {accuracy * 100:.2f}%\n")

print("This simple example demonstrates how a machine learning model can learn a pattern (even/odd) from data. Although this particular problem has a direct mathematical solution, it serves as a good introduction to classification tasks.")
