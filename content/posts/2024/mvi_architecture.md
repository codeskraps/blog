+++
title = 'Simplifying MVI Architecture'
date = 2024-09-27T13:45:09+02:00
tags = ['kotlin', 'kmp', 'android', 'mvi', 'architecture', 'mvvm', 'viewmodel']
draft = false
+++
Model-View-Intent (MVI) is a powerful architectural pattern for building user interfaces, especially in Android development. In this post, we'll explore a helper class that simplifies the implementation of MVI, making it easier to manage state, handle user intents, and emit actions in your application.
<!--more-->
## The MVI Helper Class

First, let's look at the complete helper class:

{{< highlight kotlin >}}
interface StateReceiver<STATE> {
    suspend fun updateState(transform: suspend (STATE) -> STATE)
    suspend fun withState(block: suspend (STATE) -> Unit)
}

suspend inline fun <reified TYPE : STATE, STATE> StateReceiver<STATE>.withType(
    crossinline block: suspend (TYPE) -> Unit
) {
    withState { state ->
        if (state is TYPE) {
            block(state)
        }
    }
}

suspend inline fun <reified TYPE : STATE, STATE> StateReceiver<STATE>.updateWithType(
    crossinline transform: suspend (TYPE) -> TYPE
) {
    withType<TYPE, STATE> { state ->
        updateState { transform(state) }
    }
}

interface StateProvider<STATE> {
    val state: StateFlow<STATE>
}

interface IntentReceiver<INTENT> {
    fun handleIntent(intent: INTENT)
}

interface ActionProvider<ACTION> {
    val action: Flow<ACTION>
}

interface ActionReceiver<ACTION> {
    suspend fun sendAction(block: suspend () -> ACTION)
}

interface StateModule<STATE> : StateReceiver<STATE>, StateProvider<STATE>
interface IntentModule<INTENT> : IntentReceiver<INTENT>
interface ActionModule<ACTION> : ActionReceiver<ACTION>, ActionProvider<ACTION>

interface MVIViewModel<STATE, INTENT, ACTION> : StateModule<STATE>, IntentModule<INTENT>, ActionModule<ACTION>

class MVIViewModelDelegate<STATE, INTENT, ACTION>(
    initial: STATE
) : MVIViewModel<STATE, INTENT, ACTION> {
    private val _state = MutableStateFlow(initial)
    override val state: StateFlow<STATE> = _state.asStateFlow()

    private val _action = Channel<ACTION>()
    override val action: Flow<ACTION> = _action.receiveAsFlow()

    override suspend fun updateState(transform: suspend (STATE) -> STATE) {
        _state.update { transform(it) }
    }

    override suspend fun withState(block: suspend (STATE) -> Unit) {
        block(_state.value)
    }

    override suspend fun sendAction(block: suspend () -> ACTION) {
        _action.trySend(block())
    }

    override fun handleIntent(intent: INTENT) {
        throw NotImplementedError()
    }
}
{{< /highlight >}}

## Understanding the MVI Helper Class

Let's break down the key components of our MVI helper class:

### Core Interfaces

1. `StateReceiver<STATE>`: Allows updating and accessing the current state.
2. `StateProvider<STATE>`: Provides access to the state as a `StateFlow`.
3. `IntentReceiver<INTENT>`: Handles user intents.
4. `ActionProvider<ACTION>`: Provides a flow of actions.
5. `ActionReceiver<ACTION>`: Allows sending actions.

### Composite Interfaces

1. `StateModule<STATE>`: Combines state receiving and providing.
2. `IntentModule<INTENT>`: Wraps intent receiving.
3. `ActionModule<ACTION>`: Combines action receiving and providing.
4. `MVIViewModel<STATE, INTENT, ACTION>`: The main interface combining all MVI components.

### Helper Functions

1. `withType`: Allows type-safe state access.
2. `updateWithType`: Enables type-safe state updates.

### The MVIViewModelDelegate

This class implements the `MVIViewModel` interface, providing a concrete implementation of the MVI pattern.

## Example Implementation

Let's implement a simple counter application using our MVI helper class. Note that we can use either data classes or sealed interfaces for our State, Intent, and Action definitions:

{{< highlight kotlin >}}
// Define our State, Intent, and Action
data class CounterState(val count: Int = 0)

sealed interface CounterIntent {
    object Increment : CounterIntent
    object Decrement : CounterIntent
}

sealed interface CounterAction {
    data class ShowToast(val message: String) : CounterAction
}

class CounterViewModel : MVIViewModel<CounterState, CounterIntent, CounterAction> by MVIViewModelDelegate(CounterState()) {

    init {
        handleIntent()
    }

    private fun handleIntent() = viewModelScope.launch {
        withState { state ->
            when (val intent = receiveIntent()) {
                is CounterIntent.Increment -> updateState { it.copy(count = it.count + 1) }
                is CounterIntent.Decrement -> updateState { it.copy(count = it.count - 1) }
            }
            checkCounterValue(state.count)
        }
    }

    private suspend fun checkCounterValue(count: Int) {
        if (count % 10 == 0 && count != 0) {
            sendAction { CounterAction.ShowToast("Counter is now $count!") }
        }
    }
}
{{< /highlight >}}

In this example:

1. We define our `State` as a data class, and our `Intent` and `Action` as sealed interfaces.
2. The `CounterViewModel` uses the `MVIViewModelDelegate` to implement the `MVIViewModel` interface.
3. We handle intents in the `handleIntent` function, updating the state based on the received intent.
4. The `checkCounterValue` function demonstrates how to send actions when certain conditions are met.

## Using the ViewModel in the UI

Here's how you might use this ViewModel in an Android Activity or Fragment:

{{< highlight kotlin >}}
class CounterActivity : AppCompatActivity() {
    private val viewModel: CounterViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_counter)

        // Collect state
        lifecycleScope.launch {
            viewModel.state.collect { state ->
                updateUI(state)
            }
        }

        // Collect actions
        lifecycleScope.launch {
            viewModel.action.collect { action ->
                when (action) {
                    is CounterAction.ShowToast -> Toast.makeText(this@CounterActivity, action.message, Toast.LENGTH_SHORT).show()
                }
            }
        }

        // Send intents
        incrementButton.setOnClickListener {
            viewModel.handleIntent(CounterIntent.Increment)
        }
        decrementButton.setOnClickListener {
            viewModel.handleIntent(CounterIntent.Decrement)
        }
    }

    private fun updateUI(state: CounterState) {
        counterTextView.text = state.count.toString()
    }
}
{{< /highlight >}}

## Conclusion

The MVI helper class we've explored simplifies the implementation of the MVI pattern, providing a clean and type-safe way to manage state, handle user intents, and emit actions. By using this helper class, you can create more maintainable and testable view models, leading to more robust applications.

Remember that you can use either data classes or sealed interfaces for your State, Intent, and Action definitions, depending on your specific needs. This flexibility allows you to choose the most appropriate structure for each component of your MVI architecture.

While this helper class provides a solid foundation, you may need to adapt it to fit the specific needs of your project. 
